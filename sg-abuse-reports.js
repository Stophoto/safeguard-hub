// sg-abuse-reports.js — Safeguard Hub
// Phase A F-01 helpers. No Cloud Functions yet; Firestore rules enforce
// Safeguard Lead-only reads/updates on /abuseReports.

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  getCountFromServer,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./sg-firebase.js";

export const ABUSE_REPORT_HEADERS = [
  "Record ID",
  "Report date", "Report time",
  "Reporter name", "Reporter role", "Reporter phone", "Reporter email",
  "Child name",
  "Parent / guardian", "Child address", "Child phone",
  "Nature of concern",
  "Report details",
  "Immediate actions taken", "Actions details",
  "Agency contacted", "Agency phone", "Reported to agency at", "Official spoken to",
  "Reporter signature", "Reporter signed date",
  "Supervisor signature", "Supervisor signed date",
  "Submitted at",
];

export async function createAbuseReport({ rowData, recordId }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  const data = {
    schemaVersion: 1,
    formCode: "SG-FRM-007",
    formTitle: "Suspected Abuse Report",
    tabName: "Abuse Reports",
    recordId: recordId || (rowData && rowData[0]) || "",
    rowData: rowData || [],
    submittedBy: user.uid,
    submittedByEmail: user.email || "",
    submittedAt: serverTimestamp(),
    status: "open",
    assignedLeadUid: null,
    allowedReaders: [],
    reviewedBy: null,
    reviewedByEmail: null,
    reviewedAt: null,
    closedBy: null,
    closedAt: null,
    closureReason: "",
    notes: "",
    legalHold: true,
    retentionUntil: null,
    createdVia: "direct-client-phase-a",
  };
  const ref = await addDoc(collection(db, "abuseReports"), data);
  return { id: ref.id, ...data };
}

export async function countAbuseReports() {
  const snap = await getCountFromServer(collection(db, "abuseReports"));
  return snap.data().count || 0;
}

export async function listAbuseReports({ count = 200 } = {}) {
  const q = query(collection(db, "abuseReports"), orderBy("submittedAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listLeadNotifications({ count = 10 } = {}) {
  const q = query(collection(db, "leadNotifications"), orderBy("grantedAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAbuseReport(id) {
  const snap = await getDoc(doc(db, "abuseReports", id));
  if (!snap.exists()) return null;
  return { id, ...snap.data() };
}

export async function updateAbuseReport(id, { status, notes, assignedLeadUid, closureReason }) {
  const patch = {
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.uid : null,
  };
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = notes;
  if (assignedLeadUid !== undefined) patch.assignedLeadUid = assignedLeadUid || null;
  if (status && status !== "open") {
    patch.reviewedAt = serverTimestamp();
    patch.reviewedBy = auth.currentUser ? auth.currentUser.uid : null;
    patch.reviewedByEmail = auth.currentUser ? auth.currentUser.email : null;
  }
  if (status === "closed") {
    patch.closedAt = serverTimestamp();
    patch.closedBy = auth.currentUser ? auth.currentUser.uid : null;
    patch.closureReason = (closureReason || "").trim();
  }
  await updateDoc(doc(db, "abuseReports", id), patch);
}

export function statusBadgeClass(status) {
  switch (status) {
    case "closed":   return "done";
    case "reviewed": return "pending";
    case "open":     return "required";
    default:         return "required";
  }
}
