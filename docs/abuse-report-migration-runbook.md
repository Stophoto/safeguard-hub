# SafeGuard Legacy Abuse-Report Migration Runbook

Date: 2026-05-28
Purpose: remove legacy `SG-FRM-007` suspected-abuse reports from the general
`submissions` collection and preserve them in the restricted `abuseReports`
collection.

Script: `scripts/migrate-legacy-abuse-reports.mjs`

## Plain-English Decision

The migration is the next real pre-launch blocker.

Branch cleanup is housekeeping. The legacy abuse-report records are different:
they are sensitive child-safeguarding records that may still physically sit in
the general `submissions` collection. Hiding them in the Admin Submissions
screen is not enough, because database access still matters.

## Why UI Hiding Is Not Enough

The five-fix merge hides old `SG-FRM-007` records from the ordinary Admin
Submissions page. That protects the screen only. `firestore.rules` grants
`list` and `get` on `submissions` to any Coordinator:

```
match /submissions/{submissionId} {
  allow get:  ... || isCoordinator();
  allow list: if isCoordinator();
}
```

So a Coordinator who is **not** a Safeguard Lead can still read the sensitive
report (including the reporter's identity) directly from the database. For
suspected-abuse reports, the storage location and rules must be correct, not
just the visible UI.

## Correct Migration Goal

For every legacy `SG-FRM-007` document in `submissions`:

1. Back up the data first.
2. Copy it into `abuseReports`.
3. Verify the copied record exists and **fully matches** the legacy record.
4. Delete the legacy record from `submissions`.
5. Verify `submissions` has zero `SG-FRM-007` documents.
6. Verify only Safeguard Leads can read `abuseReports`.

## What the Script Does (and its safety properties)

- **Dry run by default.** Without `RUN_MIGRATION=true` it writes nothing and
  prints what it would do.
- **Per-document order:** check existing → create → verify full read-back →
  delete. A legacy doc is deleted only after a verified, matching copy.
- **Full-content verification.** It compares a canonical signature of the
  immutable source content — `formCode`, `recordId`, `legacySubmissionId`,
  submitter metadata, and the **complete `rowData` payload** (not just its
  length). The signature excludes `migratedAt` and mutable workflow fields
  (`status`, `notes`, review/closure) so reruns and later Lead edits do not
  cause false mismatches.
- **Reruns never overwrite.** Writes use Firestore `createDocument`, which
  fails if the doc already exists. If `abuseReports/{id}` already exists and
  matches the source, the copy is skipped (and the legacy doc may still be
  deleted). If it exists and **differs**, that document is aborted and the
  legacy record is left untouched.
- **Delete requires an acknowledged backup** (`CONFIRM_BACKUP=true`).
- **Admin OAuth token** authenticates to the Firestore REST API as an IAM
  principal, which bypasses security rules — so the delete works despite
  `allow delete: if false`. No `firestore.rules` change is required.

Environment variables:

| Var | Effect |
| --- | --- |
| `GOOGLE_OAUTH_ACCESS_TOKEN` | Required. Admin OAuth access token. |
| `RUN_MIGRATION=true` | Perform writes. Omitted → dry run. |
| `LEGACY_ACTION=none\|delete` | `none` (default) = copy only; `delete` = approved production behavior. |
| `CONFIRM_BACKUP=true` | Required for `LEGACY_ACTION=delete`. |

(Tombstone mode was removed: a breadcrumb in `submissions` still reveals that
an abuse report existed, which defeats the purpose. Delete is the approved
outcome.)

## What Not To Do

- Do not paste Firebase admin credentials into chat.
- Do not run this from an AI sandbox.
- Do not run with `LEGACY_ACTION=none` and assume the exposure is closed —
  that is copy-only.
- Do not delete anything until the backup exists and the copy verifies.

## Recommended Safe Sequence

### Step 1: Pause New Abuse-Report Testing

Avoid submitting test `SG-FRM-007` reports unless clearly marked as test data.

### Step 2: Back Up Firestore

Run an official Firestore export to a Cloud Storage bucket before touching any
records:

```bash
gcloud firestore export gs://YOUR-BUCKET/safeguard-backups/2026-05-28-before-abuse-migration
```

### Step 3: Dry Run (counts only, writes nothing)

From the trusted local machine. The token is generated locally and never
pasted into chat:

```bash
export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
node scripts/migrate-legacy-abuse-reports.mjs
```

Expected: it prints how many legacy `SG-FRM-007` records it found and, for
each, what it would do.

### Step 4: Approved Production Run

Run only after: backup complete, dry-run count understood, and Chris approves
the migration window.

```bash
RUN_MIGRATION=true LEGACY_ACTION=delete CONFIRM_BACKUP=true \
  node scripts/migrate-legacy-abuse-reports.mjs
```

The script copies → verifies full content → deletes each legacy doc, then
re-queries and reports how many `SG-FRM-007` docs remain in `submissions`
(expected `0`). It exits non-zero if any record fails to verify or any remain.

### Step 5: Verify Data Location

Confirm:

- `abuseReports` contains the migrated records.
- Each migrated record has `legalHold: true`.
- Each migrated record links back via `legacySubmissionId`.
- `submissions` contains no document where `formCode == "SG-FRM-007"`.

### Step 6: Verify Access

Confirm:

- A Safeguard Lead can list/read `abuseReports`.
- A Coordinator who is not a Safeguard Lead cannot list/read `abuseReports`.
- A Volunteer cannot list/read `abuseReports`.
- An unauthenticated visitor cannot read anything sensitive.

This should become automated Firestore rules tests so access is guaranteed,
not eyeballed.

## Sources Checked

- Local repo script: `scripts/migrate-legacy-abuse-reports.mjs`
- Local repo rules: `firestore.rules`
- Google Cloud SDK docs for `gcloud firestore export`
- Firebase Firestore REST docs for document create/delete
