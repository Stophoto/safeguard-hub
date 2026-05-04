#!/usr/bin/env node

// F-01 Phase A migration helper.
//
// Purpose:
//   Copy legacy SG-FRM-007 documents from /submissions into the new
//   /abuseReports collection after PR 1 and PR 3 have been reviewed.
//
// Safety:
//   - Dry-run by default.
//   - Never deletes or edits the legacy /submissions documents.
//   - Refuses to write unless RUN_MIGRATION=true is set.
//   - Requires a Google OAuth access token with Firestore admin access.
//
// DO NOT RUN until Chris explicitly approves the migration window.

const PROJECT_ID = "safeguard-hub-71292";
const DATABASE = "(default)";
const API_ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}/documents`;
const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
const runMigration = process.env.RUN_MIGRATION === "true";

if (!token) {
  throw new Error("Set GOOGLE_OAUTH_ACCESS_TOKEN to an admin OAuth access token before running.");
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

const legacyReports = await fetchLegacyReports();
const mappedReports = legacyReports.map(mapLegacySubmission);

console.log(`Found ${mappedReports.length} legacy SG-FRM-007 submission(s).`);
for (const report of mappedReports) {
  console.log(`${runMigration ? "MIGRATE" : "DRY RUN"} ${report.id} -> abuseReports/${report.id}`);
  if (runMigration) await writeReport(report);
}

if (!runMigration) {
  console.log("Dry run only. Set RUN_MIGRATION=true to write after Chris approves.");
}
