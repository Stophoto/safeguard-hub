// sg-submissions.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// Captures every form submission to Firestore in parallel with
// the legacy Google Sheets write. Lets the Coordinator view,
// filter, and triage incident/abuse/training submissions inside
// the app — no more switching back and forth to a spreadsheet.
//
// Submission documents live at /submissions/{id}.
// ─────────────────────────────────────────────────────────────

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./sg-firebase.js";

// ── Form schema registry ────────────────────────────────────
// Maps the Google Sheets tab name to a human-friendly form code,
// title, and the column headers that correspond to the rowData
// array each form pushes. Lets the Submissions viewer show
// structured key-value fields instead of a raw array.
export const FORM_SCHEMAS = {
  "People": {
    formCode: "SG-FRM-001",
    formTitle: "Ministry Application",
    idPrefix: "PEO",
    headers: [
      "Record ID", "Full name", "Email", "Phone", "Date of birth",
      "Adult / Youth", "Age groups", "Service times", "Applied on",
      "References received", "Police check submitted", "Police check cleared",
      "Covenant signed", "Training completed", "Ministry application status",
      "Interview date", "Approval date", "Notes",
      "Renewal due", "Status", "Created at",
    ],
  },
  "Incidents": {
    formCode: "SG-FRM-006",
    formTitle: "Incident / Accident Report",
    idPrefix: "INC",
    headers: [
      "Record ID",
      "Incident date", "Incident time", "Location", "Program / Ministry",
      "Persons involved", "Age (if child)", "Parent / Guardian", "Others involved",
      "Description of incident",
      "Actions taken", "Action description",
      "Witness 1 name", "Witness 1 phone",
      "Witness 2 name", "Witness 2 phone",
      "Reporter role / position",
      "Reporter signature", "Reporter signed date",
      "Supervisor signature", "Supervisor signed date",
      "Follow-up log completed by",
      "Follow-up log entries",
      "Parent contact made", "Parent contact date", "Parent contact method", "Parent communication summary",
      "Ministry leader", "Ministry leader review date",
      "Safeguard lead", "Safeguard lead review date",
      "Further action required", "Further action description",
      "Submitted at",
    ],
  },
  "Abuse Reports": {
    formCode: "SG-FRM-007",
    formTitle: "Suspected Abuse Report",
    idPrefix: "ABU",
  },
  "Training Log": {
    formCode: "SG-FRM-012",
    formTitle: "Training Completion Record",
    idPrefix: "TRN",
  },
  "References": {
    formCode: "SG-FRM-002",
    formTitle: "Reference Check",
    idPrefix: "REF",
  },
  "Acknowledgements": {
    formCode: "SG-FRM-004",
    formTitle: "Worker's Covenant Acknowledgement",
    idPrefix: "COV",
  },
  "Registrations": {
    formCode: "SG-FRM-005",
    formTitle: "Child Registration & Medical Release",
    idPrefix: "REG",
  },
};

// ── Create a submission record ──────────────────────────────
// Called automatically every time a form writes to Sheets.
// `tabName` matches the Google Sheets tab (e.g., "Incidents").
// `rowData` is the raw array of column values written to Sheets.
// `recordId` is the rid the form generated (e.g., "INC-20260418-...").
export async function createSubmission({ tabName, rowData, recordId }) {
  const schema = FORM_SCHEMAS[tabName] || {
    formCode: "UNKNOWN",
    formTitle: tabName,
    idPrefix: "UNK",
  };

  const user = auth.currentUser;
  const data = {
    // Form identity
    formCode: schema.formCode,
    formTitle: schema.formTitle,
    tabName,
    recordId: recordId || (rowData && rowData[0]) || "",

    // Raw data from the legacy form
    rowData: rowData || [],

    // Who submitted
    submittedBy: user ? user.uid : null,
    submittedByEmail: user ? user.email : null,
    submittedAt: serverTimestamp(),

    // Coordinator triage
    status: "open",            // open | reviewed | closed
    reviewedBy: null,
    reviewedByEmail: null,
    reviewedAt: null,
    notes: "",
  };

  const ref = await addDoc(collection(db, "submissions"), data);
  return { id: ref.id, ...data };
}

// ── List submissions (coordinator-only) ─────────────────────
// Returns up to `count` most-recent submissions, newest first.
// Pass `formCode` to filter to one form type.
export async function listSubmissions({ formCode, count = 200 } = {}) {
  let q = query(collection(db, "submissions"), orderBy("submittedAt", "desc"), limit(count));
  if (formCode) {
    q = query(
      collection(db, "submissions"),
      where("formCode", "==", formCode),
      orderBy("submittedAt", "desc"),
      limit(count),
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Get one submission by its Firestore id ──────────────────
export async function getSubmission(id) {
  const snap = await getDoc(doc(db, "submissions", id));
  if (!snap.exists()) return null;
  return { id, ...snap.data() };
}

// ── Update status / notes on a submission (coordinator) ─────
export async function updateSubmission(id, { status, notes }) {
  const patch = { updatedAt: serverTimestamp() };
  if (status !== undefined) patch.status = status;
  if (notes !== undefined) patch.notes = notes;
  if (status && status !== "open") {
    patch.reviewedAt = serverTimestamp();
    patch.reviewedBy = auth.currentUser ? auth.currentUser.uid : null;
    patch.reviewedByEmail = auth.currentUser ? auth.currentUser.email : null;
  }
  await updateDoc(doc(db, "submissions", id), patch);
}

// ── Get headers for a submission, defaulting to generic ─────
// Used by the detail view to label rowData columns.
export function headersFor(tabName) {
  const schema = FORM_SCHEMAS[tabName];
  if (schema && schema.headers) return schema.headers;
  return null;
}

// ── Status label → badge color mapping ──────────────────────
export function statusBadgeClass(status) {
  switch (status) {
    case "closed":   return "done";
    case "reviewed": return "pending";
    case "open":     return "required";
    default:         return "required";
  }
}
