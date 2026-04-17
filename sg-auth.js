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

// ── Sign-up ─────────────────────────────────────────────────
// Creates an account, then immediately sends a verification email.
// After this, the user is *signed in* but their email is not verified.
export async function signUp(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user);
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
    default:
      return (err && err.message) || "Something went wrong. Please try again.";
  }
}
