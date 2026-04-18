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
    email:  "",              // filled from Firebase Auth at create-time
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
// Also backfills email onto older profiles that predate the
// `email` field.
export async function getOrCreateProfile() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const data = { ...newProfile(), email: user.email || "" };
    await setDoc(ref, data);
    return { id: user.uid, ...data };
  }
  const data = snap.data();
  // Backfill email if missing (for profiles created before we added the field).
  if (!data.email && user.email) {
    await setDoc(ref, { email: user.email }, { merge: true });
    data.email = user.email;
  }
  return { id: user.uid, ...data };
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

// ═════════════════════════════════════════════════════════════
// COMPLIANCE HELPERS — Phase 5
// Each onboarding step is stored as a nested object on the user
// profile document. These helpers write the right shape and a
// server timestamp. They never touch role/status (rules block that).
// ═════════════════════════════════════════════════════════════

// ── Sign the Worker's Covenant ───────────────────────────────
// `signatureName` is the typed-name signature captured on the covenant page.
export async function signCovenant(signatureName) {
  await saveProfile({
    covenant: {
      signed: true,
      signedAt: new Date().toISOString(),
      signatureName: (signatureName || "").trim(),
    },
  });
}

// ── Record a police-check submission (volunteer side) ────────
// `submittedOn` is a YYYY-MM-DD string the volunteer picked.
// Clearance and expiry are filled in later by the Coordinator.
export async function submitPoliceCheck(submittedOn) {
  await saveProfile({
    policeCheck: {
      submittedAt: submittedOn || new Date().toISOString().slice(0, 10),
      // Preserve any existing clearedAt/expiresOn if re-submitting early
    },
  });
}

// ── Record two references (volunteer side) ───────────────────
// `refs` is an array of up to 2 objects: { name, email, relationship }.
// Each reference gets a `receivedAt` field that starts null and gets
// set by the Coordinator when the reference actually responds.
export async function saveReferences(refs) {
  const items = (refs || []).slice(0, 2).map(r => ({
    name: (r.name || "").trim(),
    email: (r.email || "").trim().toLowerCase(),
    relationship: (r.relationship || "").trim(),
    receivedAt: r.receivedAt || null,
  }));
  await saveProfile({ references: { items } });
}

// ── Mark a training module complete (volunteer side) ─────────
// moduleId is one of the SG-T-* codes (e.g. "SG-T-001").
export async function markTrainingComplete(moduleId) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  // Read first so we merge into the existing training map cleanly.
  const snap = await getDoc(doc(db, "users", user.uid));
  const existing = (snap.exists() && snap.data().training) || {};
  existing[moduleId] = {
    completedAt: new Date().toISOString(),
  };
  await saveProfile({ training: existing });
}

// ── Undo a training completion (e.g., marked by accident) ────
export async function unmarkTrainingComplete(moduleId) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  const snap = await getDoc(doc(db, "users", user.uid));
  const existing = (snap.exists() && snap.data().training) || {};
  delete existing[moduleId];
  await saveProfile({ training: existing });
}

// ── Compute onboarding progress from a profile ───────────────
// Returns { done, total, steps: [{ id, label, state, detail }], pct }.
// `state` is one of "done" | "pending" | "not-started".
export function computeOnboarding(profile, trainingModuleIds) {
  if (!profile) return { done: 0, total: 0, steps: [], pct: 0 };
  const modules = trainingModuleIds || ["SG-T-001","SG-T-002","SG-T-003","SG-T-004"];
  const steps = [];

  // Profile
  steps.push({
    id: "profile",
    label: "Complete your profile",
    state: profile.profileComplete ? "done" : "not-started",
  });

  // Covenant
  const cov = profile.covenant || {};
  steps.push({
    id: "covenant",
    label: "Sign the Worker's Covenant",
    state: cov.signed ? "done" : "not-started",
    detail: cov.signed ? ("Signed " + formatDate(cov.signedAt)) : null,
  });

  // Police check
  const pc = profile.policeCheck || {};
  let pcState = "not-started";
  let pcDetail = null;
  if (pc.clearedAt) { pcState = "done";    pcDetail = "Cleared " + formatDate(pc.clearedAt); }
  else if (pc.submittedAt) { pcState = "pending"; pcDetail = "Submitted " + formatDate(pc.submittedAt) + " · awaiting clearance"; }
  steps.push({ id: "police", label: "Police Information Check", state: pcState, detail: pcDetail });

  // References
  const refs = (profile.references && profile.references.items) || [];
  const refReceived = refs.filter(r => r.receivedAt).length;
  steps.push({
    id: "references",
    label: "Two references",
    state: refReceived >= 2 ? "done" : (refs.length > 0 ? "pending" : "not-started"),
    detail: refs.length > 0 ? (refReceived + " of 2 received") : null,
  });

  // Training
  const training = profile.training || {};
  const completedCount = modules.filter(m => training[m] && training[m].completedAt).length;
  steps.push({
    id: "training",
    label: "Safeguard training (" + modules.length + " modules)",
    state: completedCount >= modules.length ? "done" : (completedCount > 0 ? "pending" : "not-started"),
    detail: completedCount + " of " + modules.length + " complete",
  });

  const done = steps.filter(s => s.state === "done").length;
  const total = steps.length;
  return { done, total, steps, pct: Math.round((done / total) * 100) };
}

// ── Is this profile ready to be activated? ──────────────────
// True when the user has completed every onboarding step AND
// their status is still "in-process" (i.e., not already active).
// Coordinators can always override by changing status manually.
export function isReadyForActivation(profile) {
  if (!profile) return false;
  if (profile.status !== "in-process") return false;
  const o = computeOnboarding(profile, trainingModulesFor(profile));
  return o.done === o.total;
}

// ── Training modules required for a given profile's role ────
// Volunteers need the 4 core modules. Leaders & Coordinators
// additionally need the 3 leader-track modules.
export function trainingModulesFor(profile) {
  const base = ["SG-T-001","SG-T-002","SG-T-003","SG-T-004"];
  if (!profile) return base;
  if (profile.role === "leader" || profile.role === "coordinator") {
    return [...base, "SG-T-101","SG-T-102","SG-T-103"];
  }
  return base;
}

// ── Format an ISO date / YYYY-MM-DD nicely ───────────────────
export function formatDate(d) {
  if (!d) return "";
  try {
    const date = (typeof d === "string") ? new Date(d) : (d.toDate ? d.toDate() : d);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch (_) { return String(d); }
}
