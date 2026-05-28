#!/usr/bin/env node

// F-01 Phase A migration helper.
//
// Purpose:
//   Move legacy SG-FRM-007 documents from the general /submissions
//   collection into the restricted /abuseReports collection so they are
//   no longer readable by ordinary Coordinators at the database layer.
//
//   Coordinators can list/read /submissions (see firestore.rules), so a
//   COPY-ONLY migration does NOT close the exposure. The legacy document
//   must also be removed (or tombstoned) once the copy is verified.
//
// Behavior is controlled by env vars (safe by default):
//
//   GOOGLE_OAUTH_ACCESS_TOKEN  (required) admin OAuth token. Authenticates
//                              to the Firestore REST API as an IAM principal,
//                              which bypasses security rules (so the delete
//                              works despite `allow delete: if false`).
//
//   RUN_MIGRATION=true         Perform writes. Without it, nothing is written
//                              (pure dry run: prints what WOULD happen).
//
//   LEGACY_ACTION=none|delete|tombstone   (default: none)
//       none      Copy to /abuseReports only. Leaves legacy docs in place.
//                 (Does NOT close the exposure — kept for staged rollout.)
//       delete    APPROVED PRODUCTION BEHAVIOR. After verified copy, delete
//                 the legacy /submissions/{id} document.
//       tombstone After verified copy, delete the legacy doc and recreate it
//                 with ONLY non-sensitive audit metadata (no rowData, no
//                 submitter PII, no SG-FRM-007 formCode).
//
//   CONFIRM_BACKUP=true        Required for any destructive LEGACY_ACTION.
//                              Asserts you have already run a Firestore export
//                              (see runbook Step 2). The script cannot verify
//                              the backup itself — this is your acknowledgment.
//
// Per-document order is always: COPY -> VERIFY read-back -> (delete|tombstone).
// A document is never destroyed unless its copy verified successfully.
//
// Safety summary:
//   - Dry run by default.
//   - Destructive steps require RUN_MIGRATION=true AND LEGACY_ACTION!=none
//     AND CONFIRM_BACKUP=true AND a passing per-document verification.
//   - Never deletes a legacy doc whose copy did not verify.
//
// DO NOT RUN until Chris explicitly approves the migration window.
// Run only from a trusted local machine. Never paste the token into chat.

const PROJECT_ID = "safeguard-hub-71292";
const DATABASE = "(default)";
const API_ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}/documents`;

const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
const runMigration = process.env.RUN_MIGRATION === "true";
const legacyAction = (process.env.LEGACY_ACTION || "none").toLowerCase();
const backupConfirmed = process.env.CONFIRM_BACKUP === "true";

if (!token) {
  throw new Error("Set GOOGLE_OAUTH_ACCESS_TOKEN to an admin OAuth access token before running.");
}

const VALID_ACTIONS = new Set(["none", "delete", "tombstone"]);
if (!VALID_ACTIONS.has(legacyAction)) {
  throw new Error(`LEGACY_ACTION must be one of: none, delete, tombstone (got "${legacyAction}").`);
}

const destructive = legacyAction === "delete" || legacyAction === "tombstone";

// Hard gate: never touch legacy /submissions docs without an explicit,
// acknowledged backup. This enforces "do not delete unless backup exists".
if (runMigration && destructive && !backupConfirmed) {
  throw new Error(
    `LEGACY_ACTION=${legacyAction} requires CONFIRM_BACKUP=true. ` +
      `Run a Firestore export first (see runbook Step 2), then set CONFIRM_BACKUP=true.`,
  );
}

function headers() {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function stringValue(fields, key, fallback = "") {
  return fields[key]?.stringValue ?? fallback;
}

function arrayValue(fields, key) {
  return fields[key]?.arrayValue?.values ?? [];
}

function timestampValue(fields, key) {
  return fields[key]?.timestampValue ?? null;
}

function docIdFromName(name) {
  return String(name || "").split("/").pop();
}

async function fetchLegacyReports() {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}/documents:runQuery`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "submissions" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "formCode" },
              op: "EQUAL",
              value: { stringValue: "SG-FRM-007" },
            },
          },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Query failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows.map((row) => row.document).filter(Boolean);
}

function mapLegacySubmission(doc) {
  const fields = doc.fields || {};
  const legacyId = docIdFromName(doc.name);
  const recordId = stringValue(fields, "recordId", legacyId);
  const submittedBy = stringValue(fields, "submittedBy");
  const submittedByEmail = stringValue(fields, "submittedByEmail");
  const submittedAt = timestampValue(fields, "submittedAt");

  if (!submittedBy || !submittedByEmail || !submittedAt) {
    throw new Error(`Legacy submission ${legacyId} is missing submitter metadata.`);
  }

  return {
    id: legacyId,
    recordId,
    rowDataCount: arrayValue(fields, "rowData").length,
    fields: {
      schemaVersion: { integerValue: 1 },
      formCode: { stringValue: "SG-FRM-007" },
      formTitle: { stringValue: "Suspected Abuse Report" },
      tabName: { stringValue: "Abuse Reports" },
      recordId: { stringValue: recordId },
      rowData: { arrayValue: { values: arrayValue(fields, "rowData") } },
      submittedBy: { stringValue: submittedBy },
      submittedByEmail: { stringValue: submittedByEmail },
      submittedAt: { timestampValue: submittedAt },
      status: { stringValue: stringValue(fields, "status", "open") || "open" },
      assignedLeadUid: { nullValue: null },
      allowedReaders: { arrayValue: { values: [] } },
      reviewedBy: { nullValue: null },
      reviewedByEmail: { nullValue: null },
      reviewedAt: { nullValue: null },
      closedBy: { nullValue: null },
      closedAt: { nullValue: null },
      closureReason: { stringValue: "" },
      notes: { stringValue: stringValue(fields, "notes") },
      legalHold: { booleanValue: true },
      retentionUntil: { nullValue: null },
      createdVia: { stringValue: "legacy-submissions-migration" },
      legacySubmissionId: { stringValue: legacyId },
      migratedAt: { timestampValue: new Date().toISOString() },
    },
  };
}

async function writeReport(mapped) {
  const url = `${API_ROOT}/abuseReports/${encodeURIComponent(mapped.id)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ fields: mapped.fields }),
  });
  if (!res.ok) throw new Error(`Write failed for ${mapped.id}: ${res.status} ${await res.text()}`);
}

// Read the freshly written abuseReports doc back and confirm the key fields
// match the source. A legacy doc is only destroyed after this passes.
async function verifyCopy(mapped) {
  const url = `${API_ROOT}/abuseReports/${encodeURIComponent(mapped.id)}`;
  const res = await fetch(url, { method: "GET", headers: headers() });
  if (!res.ok) return { ok: false, reason: `read-back failed: ${res.status}` };
  const doc = await res.json();
  const f = doc.fields || {};
  const gotRecordId = f.recordId?.stringValue;
  const gotLegacyId = f.legacySubmissionId?.stringValue;
  const gotRowCount = (f.rowData?.arrayValue?.values ?? []).length;
  if (gotLegacyId !== mapped.id) return { ok: false, reason: `legacySubmissionId mismatch (${gotLegacyId})` };
  if (gotRecordId !== mapped.recordId) return { ok: false, reason: `recordId mismatch (${gotRecordId})` };
  if (gotRowCount !== mapped.rowDataCount)
    return { ok: false, reason: `rowData count mismatch (${gotRowCount} vs ${mapped.rowDataCount})` };
  return { ok: true };
}

async function deleteLegacy(id) {
  const url = `${API_ROOT}/submissions/${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(`Delete failed for submissions/${id}: ${res.status} ${await res.text()}`);
}

// Tombstone = delete then recreate with ONLY non-sensitive audit metadata.
// Deliberately omits formCode SG-FRM-007, rowData, and submitter PII so the
// record reveals nothing and won't match the SG-FRM-007 verification query.
async function tombstoneLegacy(mapped) {
  await deleteLegacy(mapped.id);
  const url = `${API_ROOT}/submissions/${encodeURIComponent(mapped.id)}`;
  const fields = {
    status: { stringValue: "migrated" },
    migratedTo: { stringValue: `abuseReports/${mapped.id}` },
    legacySubmissionId: { stringValue: mapped.id },
    recordId: { stringValue: mapped.recordId },
    migratedAt: { timestampValue: new Date().toISOString() },
    note: { stringValue: "Sensitive SG-FRM-007 content moved to restricted abuseReports." },
  };
  const res = await fetch(url, { method: "PATCH", headers: headers(), body: JSON.stringify({ fields }) });
  if (!res.ok) throw new Error(`Tombstone write failed for submissions/${mapped.id}: ${res.status} ${await res.text()}`);
}

// ── main ────────────────────────────────────────────────────────────────
const legacyReports = await fetchLegacyReports();
const mappedReports = legacyReports.map(mapLegacySubmission);

const mode = !runMigration ? "DRY RUN" : "LIVE";
console.log(`Mode: ${mode} | LEGACY_ACTION=${legacyAction} | backupConfirmed=${backupConfirmed}`);
console.log(`Found ${mappedReports.length} legacy SG-FRM-007 submission(s).`);

let copied = 0;
let destroyed = 0;
const failures = [];

for (const report of mappedReports) {
  if (!runMigration) {
    const wouldDestroy = destructive ? ` -> then ${legacyAction} submissions/${report.id}` : "";
    console.log(`DRY RUN ${report.id} -> abuseReports/${report.id} (verify)${wouldDestroy}`);
    continue;
  }

  try {
    await writeReport(report);
    copied++;

    const v = await verifyCopy(report);
    if (!v.ok) {
      failures.push(`${report.id}: copy NOT verified (${v.reason}); legacy doc left untouched`);
      console.log(`COPIED ${report.id} -> abuseReports/${report.id} | VERIFY FAILED (${v.reason}) | legacy kept`);
      continue;
    }

    if (legacyAction === "delete") {
      await deleteLegacy(report.id);
      destroyed++;
      console.log(`COPIED+VERIFIED ${report.id} | DELETED submissions/${report.id}`);
    } else if (legacyAction === "tombstone") {
      await tombstoneLegacy(report);
      destroyed++;
      console.log(`COPIED+VERIFIED ${report.id} | TOMBSTONED submissions/${report.id}`);
    } else {
      console.log(`COPIED+VERIFIED ${report.id} | legacy kept (LEGACY_ACTION=none)`);
    }
  } catch (err) {
    failures.push(`${report.id}: ${err.message}`);
    console.log(`ERROR on ${report.id}: ${err.message}`);
  }
}

// Final assertion: confirm the exposure is actually closed.
if (runMigration && destructive) {
  const remaining = await fetchLegacyReports();
  console.log(`\nPost-migration check: ${remaining.length} SG-FRM-007 doc(s) remain in /submissions (expected 0).`);
  if (remaining.length > 0) {
    failures.push(`${remaining.length} SG-FRM-007 doc(s) still in /submissions after migration`);
  }
}

if (!runMigration) {
  console.log("\nDry run only. To write: RUN_MIGRATION=true.");
  console.log("Approved production run: RUN_MIGRATION=true LEGACY_ACTION=delete CONFIRM_BACKUP=true (after Chris approves + backup done).");
} else {
  console.log(`\nDone. copied=${copied} destroyed=${destroyed} failures=${failures.length}`);
}

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
