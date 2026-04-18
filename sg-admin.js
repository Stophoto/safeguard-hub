// sg-admin.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// Coordinator-only helpers: list all users, change a user's role
// or status, and create invite records.
//
// Security is enforced by Firestore Security Rules — a non-
// coordinator calling these will be rejected server-side, so
// these helpers don't need to check roles themselves.
// ─────────────────────────────────────────────────────────────

import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./sg-firebase.js";

// ── List all users ──────────────────────────────────────────
// Returns an array of { id, ...profileData }. Sorted by last name.
export async function listUsers() {
  const q = query(collection(db, "users"), orderBy("lastName"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Change a user's role ────────────────────────────────────
// role: "volunteer" | "leader" | "coordinator"
export async function setUserRole(uid, role) {
  if (!["volunteer", "leader", "coordinator"].includes(role)) {
    throw new Error("Invalid role: " + role);
  }
  await updateDoc(doc(db, "users", uid), {
    role,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  });
}

// ── Change a user's status ──────────────────────────────────
// status: "in-process" | "active" | "paused" | "inactive"
export async function setUserStatus(uid, status) {
  if (!["in-process", "active", "paused", "inactive"].includes(status)) {
    throw new Error("Invalid status: " + status);
  }
  await updateDoc(doc(db, "users", uid), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  });
}

// ── Create an invite record ─────────────────────────────────
// Returns the created invite { id, email, ... }.
// We store these so the Coordinator has a record of who was
// invited and when. The actual email is sent by the Coordinator
// from their own email client (mailto: handoff on the invite page).
export async function createInvite({ email, suggestedMinistry = "", note = "" }) {
  if (!email) throw new Error("Email is required.");
  const data = {
    email: email.toLowerCase().trim(),
    suggestedMinistry: (suggestedMinistry || "").trim(),
    note: (note || "").trim(),
    status: "sent",                // sent | accepted | cancelled
    invitedBy: auth.currentUser ? auth.currentUser.uid : null,
    invitedByEmail: auth.currentUser ? auth.currentUser.email : null,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, "invites"), data);
  return { id: ref.id, ...data };
}

// ── Compute summary stats from a users list ─────────────────
// Returns { active, inProcess, leaders, renewalSoon }.
// `renewalSoon` counts profiles whose renewal date is within 30 days.
// For Phase 3, renewalDueOn doesn't exist yet, so it returns 0.
export function summarizeUsers(users) {
  const now = new Date();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  let active = 0, inProcess = 0, leaders = 0, renewalSoon = 0;
  users.forEach(u => {
    if (u.status === "active") active++;
    if (u.status === "in-process") inProcess++;
    if (u.role === "leader" || u.role === "coordinator") leaders++;
    if (u.renewalDueOn) {
      const due = new Date(u.renewalDueOn);
      if (due - now < thirtyDaysMs) renewalSoon++;
    }
  });
  return { active, inProcess, leaders, renewalSoon, total: users.length };
}
