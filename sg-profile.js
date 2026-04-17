// sg-profile.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// Firestore helpers for reading and writing a user's profile.
// Every signed-in user has exactly one document at:
//     /users/{firebaseUid}
//
// Usage:
//   import { getOrCreateProfile, saveProfile, routeAfterLogin } from "./sg-profile.js";
// ─────────────────────────────────────────────────────────────

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./sg-firebase.js";

// ── Default profile shape ───────────────────────────────────
// Used when a user signs up for the first time. Compliance
// fields (covenant, policeCheck, training) start empty and are
// populated by later phases.
function newProfile() {
  return {
    role:   "volunteer",     // volunteer | leader | coordinator
    status: "in-process",    // in-process | active | paused | inactive

    // Personal info (filled in profile-setup)
    firstName: "",
    lastName: "",
    preferredName: "",
    dob: "",
    phone: "",
    address: { street: "", city: "", province: "", postal: "" },

    // Emergency contact
    emergencyContact: { name: "", phone: "", relationship: "" },

    // Ministry preferences
    ageGroups: [],          // subset of ["nursery","preschool","elementary","preteen","youth"]
    serviceTimes: [],       // subset of ["9am","11am","wed-pm","special"]
    testimony: "",
    attendingSince: "",

    // Onboarding status
    profileComplete: false,

    // Audit
    createdAt: serverTimestamp(),
  };
}

// ── Get or create the current user's profile ────────────────
// First time a user signs in, this creates a default stub.
// Every subsequent call just reads the existing document.
export async function getOrCreateProfile() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const data = newProfile();
    await setDoc(ref, data);
    return { id: user.uid, ...data };
  }
  return { id: user.uid, ...snap.data() };
}

// ── Load the current user's profile without creating it ─────
// Returns null if no profile exists. Useful for pages that
// should react to missing data (e.g., route to profile-setup).
export async function loadProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() ? { id: user.uid, ...snap.data() } : null;
}

// ── Save updates (merges with existing fields) ──────────────
// Callers pass only the fields they want to change. Firestore
// merges them in — untouched fields stay as they were.
export async function saveProfile(updates) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  const ref = doc(db, "users", user.uid);
  await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
}

// ── Live subscription to the current user's profile ─────────
// Returns an unsubscribe function. Callback fires whenever the
// profile document changes in Firestore.
export function subscribeProfile(callback) {
  const user = auth.currentUser;
  if (!user) { callback(null); return () => {}; }
  const ref = doc(db, "users", user.uid);
  return onSnapshot(ref, snap => {
    callback(snap.exists() ? { id: user.uid, ...snap.data() } : null);
  });
}

// ── Routing helper ──────────────────────────────────────────
// Given a profile, returns the URL the user should land on
// after signing in. New users → profile setup.
// Returning users with a complete profile → dashboard.
export function routeAfterLogin(profile) {
  if (!profile || !profile.profileComplete) return "profile-setup.html";
  return "dashboard.html";
}

// ── Display-name helper ─────────────────────────────────────
// Used for the user pill in the top nav. Prefers preferredName,
// then firstName, then the part of the email before the @.
export function displayName(profile) {
  if (!profile) return "";
  if (profile.preferredName) return profile.preferredName;
  if (profile.firstName) return profile.firstName;
  const email = auth.currentUser && auth.currentUser.email;
  return email ? email.split("@")[0] : "";
}

// ── Role label for the user pill ────────────────────────────
export function roleLabel(profile) {
  if (!profile) return "";
  switch (profile.role) {
    case "coordinator": return "Coordinator";
    case "leader":      return "Leader";
    case "volunteer":   return profile.profileComplete ? "Volunteer" : "In-process";
    default:            return "";
  }
}
