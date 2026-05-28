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
//   must also be removed once the copy is verified.
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
//   LEGACY_ACTION=none|delete  (default: none)
//       none    Copy to /abuseReports only; leaves legacy docs in place.
//               (Does NOT close the exposure — kept for staged rollout.)
//       delete  APPROVED PRODUCTION BEHAVIOR. After a verified copy, delete
//               the legacy /submissions/{id} document.
//
//   CONFIRM_BACKUP=true        Required for LEGACY_ACTION=delete. Asserts you
//                              have already run a Firestore export (runbook
//                              Step 2). The script cannot verify the backup
//                              itself — this is your acknowledgment.
//
// Per-document order is always: (check existing) -> CREATE -> VERIFY full
// read-back -> delete. A legacy doc is never deleted unless its copy is
// present in /abuseReports AND its content fully matches the source.
//
// Rerun safety:
//   - Writes use Firestore createDocument, which FAILS if the doc exists
//     (never a blind overwrite).
//   - If /abuseReports/{id} already exists and MATCHES the source, the copy
//     step is skipped and the legacy doc may still be deleted.
//   - If it exists and DIFFERS, that document is aborted (left untouched).
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

const VALID_ACTIONS = new Set(["none", "delete"]);
if (!VALID_ACTIONS.has(legacyAction)) {
  throw new Error(`LEGACY_ACTION must be one of: none, delete (got "${legacyAction}").`);
}

const destructive = legacyAction === "delete";

// Hard gate: never delete a legacy /submissions doc without an explicit,
// acknowledged backup.
if (runMigration && destructive && !backupConfirmed) {
  throw new Error(
    `LEGACY_ACTION=delete requires CONFIRM_BACKUP=true. ` +
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

// Canonical signature of the immutable source report content. Excludes
// migration bookkeeping (migratedAt) and mutable workflow fields a Lead may
// edit later (status, notes, review/closure, assignedLeadUid) so that reruns
// and post-migration edits don't cause false mismatches. Compares the FULL
// rowData payload, not just its length.
function identitySig(fields) {
  return JSON.stringify({
    formCode: fields.formCode?.stringValue ?? null,
    recordId: fields.recordId?.stringValue ?? null,
    legacySubmissionId: fields.legacySubmissionId?.stringValue ?? null,
    submittedBy: fields.submittedBy?.stringValue ?? null,
    submittedByEmail: fields.submittedByEmail?.stringValue ?? null,
    submittedAt: fields.submittedAt?.timestampValue ?? null,
    rowData: fields.rowData?.arrayValue?.values ?? [],
  });
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

// Returns { exists: false } or { exists: true, fields }.
async function getAbuseReport(id) {
  const url = `${API_ROOT}/abuseReports/${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: "GET", headers: headers() });
  if (res.status === 404) return { exists: false };
  if (!res.ok) throw new Error(`Read failed for abuseReports/${id}: ${res.status} ${await res.text()}`);
  const doc = await res.json();
  return { exists: true, fields: doc.fields || {} };
}

// createDocument fails with 409 if the doc already exists — never overwrites.
async function createReport(mapped) {
  const url = `${API_ROOT}/abuseReports?documentId=${encodeURIComponent(mapped.id)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ fields: mapped.fields }),
  });
  if (res.status === 409) throw new Error(`abuseReports/${mapped.id} already exists (concurrent run?) — aborted.`);
  if (!res.ok) throw new Error(`Create failed for ${mapped.id}: ${res.status} ${await res.text()}`);
}

async function deleteLegacy(id) {
  const url = `${API_ROOT}/submissions/${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(`Delete failed for submissions/${id}: ${res.status} ${await res.text()}`);
}

// ── main ────────────────────────────────────────────────────────────────
const legacyReports = await fetchLegacyReports();
const mappedReports = legacyReports.map(mapLegacySubmission);

const mode = !runMigration ? "DRY RUN" : "LIVE";
console.log(`Mode: ${mode} | LEGACY_ACTION=${legacyAction} | backupConfirmed=${backupConfirmed}`);
console.log(`Found ${mappedReports.length} legacy SG-FRM-007 submission(s).`);

let created = 0;
let skipped = 0;
let deleted = 0;
const failures = [];

for (const report of mappedReports) {
  const expected = identitySig(report.fields);
  let existing;
  try {
    existing = await getAbuseReport(report.id);
  } catch (err) {
    failures.push(`${report.id}: ${err.message}`);
    console.log(`ERROR on ${report.id}: ${err.message}`);
    continue;
  }

  // Decide the copy disposition (and detect mismatches) before any write.
  let copyOk = false;
  if (existing.exists) {
    if (identitySig(existing.fields) === expected) {
      copyOk = true;
      if (!runMigration) {
        console.log(`DRY RUN ${report.id} | already in abuseReports and MATCHES (would skip copy)`);
      } else {
        skipped++;
        console.log(`SKIP COPY ${report.id} | already in abuseReports and matches`);
      }
    } else {
      failures.push(`${report.id}: abuseReports/${report.id} exists but DIFFERS from source — left untouched`);
      console.log(`CONFLICT ${report.id} | abuseReports doc differs from source | legacy kept`);
      continue;
    }
  } else if (!runMigration) {
    console.log(`DRY RUN ${report.id} -> would create abuseReports/${report.id}, verify, then ${destructive ? "delete" : "keep"} legacy`);
  } else {
    try {
      await createReport(report);
      created++;
      const remote = await getAbuseReport(report.id);
      if (remote.exists && identitySig(remote.fields) === expected) {
        copyOk = true;
        console.log(`CREATED+VERIFIED ${report.id} -> abuseReports/${report.id}`);
      } else {
        failures.push(`${report.id}: read-back verify failed — legacy doc left untouched`);
        console.log(`VERIFY FAILED ${report.id} | legacy kept`);
        continue;
      }
    } catch (err) {
      failures.push(`${report.id}: ${err.message}`);
      console.log(`ERROR on ${report.id}: ${err.message}`);
      continue;
    }
  }

  // Destroy the legacy doc only after a verified/matching copy.
  if (runMigration && destructive && copyOk) {
    try {
      await deleteLegacy(report.id);
      deleted++;
      console.log(`DELETED submissions/${report.id}`);
    } catch (err) {
      failures.push(`${report.id}: ${err.message}`);
      console.log(`ERROR deleting ${report.id}: ${err.message}`);
    }
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
  console.log(`\nDone. created=${created} skipped=${skipped} deleted=${deleted} failures=${failures.length}`);
}

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
