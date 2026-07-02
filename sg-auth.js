// sg-auth.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// Thin wrapper around Firebase Auth. Keeps all auth calls in one
// place so pages can stay focused on UI.
//
// Usage from any page:
//   <script type="module">
//     import { signUp, signIn, onUserChange } from "./sg-auth.js";
//     ...
//   </script>
// ─────────────────────────────────────────────────────────────

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  reload,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { auth } from "./sg-firebase.js";

// Browser back/forward cache can show a stale signed-in page after sign-out.
// Reload restored pages so Firebase Auth and the page gate run again.
if (typeof window !== "undefined") {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });
}

// ── Sign-up ─────────────────────────────────────────────────
// Creates an account and signs the user in. Email verification is not
// required right now — to revisit properly later, alongside MFA for leaders.
export async function signUp(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Sign-in ─────────────────────────────────────────────────
export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Sign-out ────────────────────────────────────────────────
export async function signOutUser() {
  await signOut(auth);
}

// ── Password reset ──────────────────────────────────────────
// Firebase emails the user a link to pick a new password.
export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── Resend verification email ───────────────────────────────
// Only works if someone is currently signed in (i.e. they're on
// the "check your inbox" page and want another copy).
export async function resendVerification() {
  if (!auth.currentUser) throw new Error("Not signed in.");
  await sendEmailVerification(auth.currentUser);
}

// ── Reload current user ─────────────────────────────────────
// Firebase caches the user's verified-status locally. After the
// user clicks the link in their email, we need to refresh to see
// the new `emailVerified: true` value.
export async function reloadUser() {
  if (auth.currentUser) await reload(auth.currentUser);
  return auth.currentUser;
}

// ── Auth state listener ─────────────────────────────────────
// Fires once on page load with the current user (or null),
// and again every time the user signs in or out.
export function onUserChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── Synchronous current-user accessor ───────────────────────
export function currentUser() {
  return auth.currentUser;
}

// ── Friendly error messages ─────────────────────────────────
// Firebase returns machine error codes ("auth/wrong-password"). Translate.
export function friendlyError(err) {
  const code = (err && err.code) || "";
  switch (code) {
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in.";
    case "auth/weak-password":
      return "Password must be at least 8 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a minute and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact the Safeguard Coordinator.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/admin-restricted-operation":
    case "auth/operation-not-allowed":
      return "This sign-in method isn't switched on yet. A coordinator needs to enable it in Firebase → Authentication → Sign-in method (turn on Email/Password and Google), then try again.";
    case "auth/unauthorized-domain":
      return "This web address isn't approved for sign-in yet. A coordinator needs to add it under Firebase → Authentication → Settings → Authorized domains.";
    case "auth/popup-blocked":
    case "auth/popup-closed-by-user":
      return "The sign-in pop-up didn't finish. Allow pop-ups for this site, then try again.";
    default:
      return (err && err.message) || "Something went wrong. Please try again.";
  }
}

// ── Friendly message for data load/save failures ────────────
// Never shows raw "Firebase: Error (…)" text to a volunteer. Covers the
// Firestore cases (permission/network) and falls back to a calm generic
// line. Use this anywhere we read/write Firestore, not just sign-in.
export function friendlyLoadError(err) {
  const code = (err && err.code) || "";
  const raw = (err && err.message) || "";
  if (code === "permission-denied" || /insufficient permissions/i.test(raw)) {
    return "We couldn't complete that — your access may have changed. Try signing out and back in, and contact the Safeguard Coordinator if it keeps happening.";
  }
  if (code === "unavailable" || code === "deadline-exceeded"
      || code === "auth/network-request-failed" || /network|offline/i.test(raw)) {
    return "We're having trouble connecting. Check your internet connection and try again.";
  }
  // Reuse the auth-code map when this is an auth error, but never let the
  // raw Firebase message through.
  const mapped = friendlyError(err);
  if (mapped && mapped !== raw && !/^Firebase:/i.test(mapped)) return mapped;
  return "Something went wrong. Please try again, and contact the Safeguard Coordinator if it continues.";
}
