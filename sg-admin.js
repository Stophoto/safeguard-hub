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
  getDoc,
  updateDoc,
  setDoc,
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

// ── Change safeguard access flags ───────────────────────────
// Phase A stores these as profile booleans. Rules restrict writes
// to safeguard_lead_admin users plus the temporary bootstrap UID.
export async function setSafeguardAccess(uid, { safeguardLead, safeguardLeadAdmin, mfaEnrolled } = {}) {
  const patch = {
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  };
  if (safeguardLead !== undefined) patch.safeguard_lead = !!safeguardLead;
  if (safeguardLeadAdmin !== undefined) patch.safeguard_lead_admin = !!safeguardLeadAdmin;
  if (mfaEnrolled !== undefined) patch.mfaEnrolled = !!mfaEnrolled;
  await updateDoc(doc(db, "users", uid), patch);
}

export async function grantTemporaryAbuseAccess(uid, { reportId, reason }) {
  const cleanReportId = (reportId || "").trim();
  const cleanReason = (reason || "").trim();
  if (!cleanReportId) throw new Error("Report ID is required.");
  if (!cleanReason) throw new Error("Written reason is required.");
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const grant = {
    grantedBy: auth.currentUser ? auth.currentUser.uid : null,
    grantedByEmail: auth.currentUser ? auth.currentUser.email : null,
    grantedAt: serverTimestamp(),
    expiresAt: expires,
    reason: cleanReason,
    reportId: cleanReportId,
  };
  await updateDoc(doc(db, "users", uid), {
    temporaryAbuseAccess: grant,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  });
  await addDoc(collection(db, "leadNotifications"), {
    type: "temporaryAbuseAccess",
    targetUid: uid,
    reportId: cleanReportId,
    reason: cleanReason,
    grantedBy: auth.currentUser ? auth.currentUser.uid : null,
    grantedByEmail: auth.currentUser ? auth.currentUser.email : null,
    grantedAt: serverTimestamp(),
    expiresAt: expires,
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

// ── Load any user's profile by uid ──────────────────────────
// Requires the caller to be a Coordinator (enforced by rules).
export async function loadUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { id: uid, ...snap.data() };
}

// ── Update any user's profile fields (coordinator) ──────────
// Merges with existing — untouched fields stay as they were.
// `updates` can include role and status; rules allow those
// only if the caller is a Coordinator.
export async function updateUserProfile(uid, updates) {
  await setDoc(doc(db, "users", uid), {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}

// ── Build a CSV string from a users list ────────────────────
// Columns chosen to match what a coordinator would actually
// want in a spreadsheet: identity, role, status, contact info,
// emergency contact, ministry prefs, and audit timestamps.
export function usersToCsv(users) {
  const headers = [
    "User ID","Email","First name","Last name","Preferred name",
    "Role","Safeguard lead","Safeguard lead admin","MFA enrolled","Status","Profile complete",
    "Date of birth","Phone",
    "Street","City","Province","Postal",
    "Emergency contact name","Emergency contact phone","Emergency contact relationship",
    "Age groups","Service times",
    "Attending since","Testimony",
    "Created at","Updated at",
  ];

  const rows = users.map(u => [
    u.id,
    u.email,
    u.firstName, u.lastName, u.preferredName,
    u.role,
    u.safeguard_lead ? "yes" : "no",
    u.safeguard_lead_admin ? "yes" : "no",
    u.mfaEnrolled ? "yes" : "no",
    u.status,
    u.profileComplete ? "yes" : "no",
    u.dob, u.phone,
    u.address && u.address.street,
    u.address && u.address.city,
    u.address && u.address.province,
    u.address && u.address.postal,
    u.emergencyContact && u.emergencyContact.name,
    u.emergencyContact && u.emergencyContact.phone,
    u.emergencyContact && u.emergencyContact.relationship,
    (u.ageGroups || []).join("; "),
    (u.serviceTimes || []).join("; "),
    u.attendingSince, u.testimony,
    tsToIso(u.createdAt),
    tsToIso(u.updatedAt),
  ]);

  return [headers, ...rows].map(toCsvLine).join("\r\n") + "\r\n";
}

// ── Trigger a CSV file download in the browser ──────────────
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// ── Helpers ─────────────────────────────────────────────────
function toCsvLine(arr) {
  return arr.map(cell => {
    const s = (cell === null || cell === undefined) ? "" : String(cell);
    // Wrap in quotes if the cell contains comma, quote, or newline.
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }).join(",");
}
function tsToIso(ts) {
  if (!ts) return "";
  if (ts.toDate) return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return "";
}

// ═════════════════════════════════════════════════════════════
// COORDINATOR COMPLIANCE HELPERS — Phase 5
// Only coordinators can call these (enforced by Firestore rules).
// ═════════════════════════════════════════════════════════════

// ── Mark a police check as cleared ──────────────────────────
// Sets clearedAt and expiresOn. expiresOn is auto-set to 3 years
// from clearedAt unless explicitly provided.
export async function markPoliceCheckCleared(uid, clearedOn, expiresOn) {
  const cleared = clearedOn || new Date().toISOString().slice(0, 10);
  let expiry = expiresOn;
  if (!expiry) {
    const d = new Date(cleared);
    d.setFullYear(d.getFullYear() + 3);
    expiry = d.toISOString().slice(0, 10);
  }
  // Merge into the existing policeCheck object so we don't lose submittedAt.
  const snap = await getDoc(doc(db, "users", uid));
  const existing = (snap.exists() && snap.data().policeCheck) || {};
  await setDoc(doc(db, "users", uid), {
    policeCheck: { ...existing, clearedAt: cleared, expiresOn: expiry },
    renewalDueOn: expiry,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}

// ── Clear a police check clearance (if entered in error) ────
export async function unclearPoliceCheck(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  const existing = (snap.exists() && snap.data().policeCheck) || {};
  delete existing.clearedAt;
  delete existing.expiresOn;
  await setDoc(doc(db, "users", uid), {
    policeCheck: existing,
    renewalDueOn: null,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}

// ── Mark a reference as received ────────────────────────────
export async function markReferenceReceived(uid, refIndex, receivedOn) {
  const date = receivedOn || new Date().toISOString().slice(0, 10);
  const snap = await getDoc(doc(db, "users", uid));
  const existing = (snap.exists() && snap.data().references) || { items: [] };
  const items = (existing.items || []).slice();
  if (!items[refIndex]) return;
  items[refIndex] = { ...items[refIndex], receivedAt: date };
  await setDoc(doc(db, "users", uid), {
    references: { items },
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}

// ── Activate a volunteer (set status to "active") ───────────
// Also stamps `activatedAt` and `activatedBy` for audit trail.
export async function activateUser(uid) {
  await setDoc(doc(db, "users", uid), {
    status: "active",
    activatedAt: serverTimestamp(),
    activatedBy: auth.currentUser ? auth.currentUser.uid : null,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}

// ── Mark a reference as NOT received (undo) ─────────────────
export async function unmarkReferenceReceived(uid, refIndex) {
  const snap = await getDoc(doc(db, "users", uid));
  const existing = (snap.exists() && snap.data().references) || { items: [] };
  const items = (existing.items || []).slice();
  if (!items[refIndex]) return;
  items[refIndex] = { ...items[refIndex], receivedAt: null };
  await setDoc(doc(db, "users", uid), {
    references: { items },
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}

// ═════════════════════════════════════════════════════════════
// SCREENING HELPERS — SG-SOP-001
// Track each volunteer's screening progress (interview, approval,
// ministry assignment) as nested objects under profile.screening.
// Single source of truth — no separate Firestore collection needed.
// ═════════════════════════════════════════════════════════════

// ── Record interview outcome ───────────────────────────────
export async function setScreeningInterview(uid, { interviewer, date, notes }) {
  const snap = await getDoc(doc(db, "users", uid));
  const existing = (snap.exists() && snap.data().screening) || {};
  const interview = {
    interviewer: (interviewer || "").trim(),
    date: (date || new Date().toISOString().slice(0, 10)),
    notes: (notes || "").trim(),
    recordedBy: auth.currentUser ? auth.currentUser.uid : null,
    recordedByEmail: auth.currentUser ? auth.currentUser.email : null,
    recordedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, "users", uid), {
    screening: { ...existing, interview },
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}
export async function clearScreeningInterview(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  const existing = (snap.exists() && snap.data().screening) || {};
  delete existing.interview;
  await setDoc(doc(db, "users", uid), {
    screening: existing,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}

// ── Record approval decision ───────────────────────────────
// decision: "approved" | "declined"
export async function setScreeningApproval(uid, { decision, approvedBy, date, notes }) {
  if (!["approved", "declined"].includes(decision)) {
    throw new Error("Invalid decision: " + decision);
  }
  const snap = await getDoc(doc(db, "users", uid));
  const existing = (snap.exists() && snap.data().screening) || {};
  const approval = {
    decision,
    approvedBy: (approvedBy || "").trim(),
    date: (date || new Date().toISOString().slice(0, 10)),
    notes: (notes || "").trim(),
    recordedBy: auth.currentUser ? auth.currentUser.uid : null,
    recordedByEmail: auth.currentUser ? auth.currentUser.email : null,
    recordedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, "users", uid), {
    screening: { ...existing, approval },
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}
export async function clearScreeningApproval(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  const existing = (snap.exists() && snap.data().screening) || {};
  delete existing.approval;
  await setDoc(doc(db, "users", uid), {
    screening: existing,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}

// ── Record ministry assignment ─────────────────────────────
export async function setMinistryAssignment(uid, { ministry, date, notes }) {
  const snap = await getDoc(doc(db, "users", uid));
  const existing = (snap.exists() && snap.data().screening) || {};
  const ministryAssigned = {
    ministry: (ministry || "").trim(),
    date: (date || new Date().toISOString().slice(0, 10)),
    notes: (notes || "").trim(),
    assignedBy: auth.currentUser ? auth.currentUser.uid : null,
    assignedByEmail: auth.currentUser ? auth.currentUser.email : null,
    assignedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, "users", uid), {
    screening: { ...existing, ministryAssigned },
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}
export async function clearMinistryAssignment(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  const existing = (snap.exists() && snap.data().screening) || {};
  delete existing.ministryAssigned;
  await setDoc(doc(db, "users", uid), {
    screening: existing,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  }, { merge: true });
}

// ── Compute screening state label for a profile ────────────
// Returns one of: "not-started" | "interview-scheduled" |
// "interview-done" | "approved" | "declined" | "assigned"
export function screeningState(profile) {
  const s = profile && profile.screening;
  if (!s) return "not-started";
  if (s.ministryAssigned && s.ministryAssigned.ministry) return "assigned";
  if (s.approval && s.approval.decision === "declined") return "declined";
  if (s.approval && s.approval.decision === "approved") return "approved";
  if (s.interview && s.interview.date) return "interview-done";
  return "not-started";
}

export function screeningLabel(state) {
  switch (state) {
    case "not-started":       return "Not started";
    case "interview-done":    return "Interview done";
    case "approved":          return "Approved";
    case "declined":          return "Declined";
    case "assigned":          return "Ministry assigned";
    default:                  return state;
  }
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
