# F-01 Design: Safeguard-Lead-Only Abuse Reports

Status: design proposal only  
Target branch: `auth-feature`  
Related finding: F-01 in `SECURITY_REVIEW.md`

## Goal

Suspected abuse reports (`SG-FRM-007`) should not be treated like ordinary form submissions. They include minors' names, reporter identity, allegation text, agency contact details, and potentially legally sensitive facts. The next implementation should:

- Move new `SG-FRM-007` records into a dedicated `abuseReports` collection.
- Restrict read/list/update access to users with a `safeguard_lead` custom claim.
- Keep ordinary Coordinators out of suspected abuse reports unless they are also designated safeguard leads.
- Write durable audit entries whenever a report is created, opened, listed, updated, exported, or migrated.
- Prefer Cloud Function-mediated reads over direct client reads so "who viewed what" is reliable.

This document intentionally does not implement code. It is the design for review before F-01 work starts.

## Current State

`SG-FRM-007.html` currently calls:

```js
await createSubmission({ tabName: "Abuse Reports", rowData, recordId });
```

`sg-submissions.js` maps `"Abuse Reports"` to `formCode: "SG-FRM-007"` and stores the record in `/submissions/{id}`.

`admin-submissions.html` lets Coordinators list all submissions and filter by form type. That means suspected abuse reports sit beside applications, incidents, registrations, references, covenants, and training logs.

## Proposed Schema

### Collection

`/abuseReports/{reportId}`

Use Firestore auto IDs for the document ID. Keep the human-readable report number in `recordId`.

### Fields

Identity and status:

- `recordId`: string, e.g. `ABU-20260428-143022`
- `formCode`: string, always `SG-FRM-007`
- `status`: string enum: `open`, `reviewed`, `referred`, `closed`
- `severity`: string enum: `unknown`, `low`, `medium`, `high`, `urgent`
- `legalHold`: boolean

Reporter:

- `reporter`: map
- `reporter.name`: string
- `reporter.role`: string
- `reporter.phone`: string
- `reporter.email`: string
- `reporter.uid`: string or null

Child/family:

- `child`: map
- `child.name`: string
- `child.address`: string
- `child.phone`: string
- `parentGuardian`: string

Report details:

- `reportDate`: string, `YYYY-MM-DD`
- `reportTime`: string, `HH:mm`
- `natureOfConcern`: string enum: `disclosure`, `witnessed`, `suspicion`, `other`
- `details`: string
- `immediateActions`: list of strings
- `actionDetails`: string

External agency:

- `agency`: map
- `agency.name`: string
- `agency.phone`: string
- `agency.reportedAt`: string
- `agency.officialSpokenTo`: string

Signatures:

- `signatures`: map
- `signatures.reporterName`: string
- `signatures.reporterSignedDate`: string
- `signatures.supervisorName`: string
- `signatures.supervisorSignedDate`: string

Triage:

- `assignedLeadUid`: string or null
- `assignedLeadEmail`: string or null
- `leadNotes`: string
- `closedReason`: string

Audit metadata:

- `submittedBy`: string
- `submittedByEmail`: string
- `submittedAt`: timestamp
- `createdAt`: timestamp
- `updatedAt`: timestamp
- `updatedBy`: string or null
- `updatedByEmail`: string or null
- `migratedFromSubmissionId`: string or null

### Sample Document

```json
{
  "recordId": "ABU-20260428-143022",
  "formCode": "SG-FRM-007",
  "status": "open",
  "severity": "unknown",
  "legalHold": true,
  "reporter": {
    "name": "Jane Volunteer",
    "role": "Nursery volunteer",
    "phone": "403-555-0101",
    "email": "jane@example.com",
    "uid": "firebase-user-uid"
  },
  "child": {
    "name": "Child Name",
    "address": "123 Example Street",
    "phone": ""
  },
  "parentGuardian": "Parent Name",
  "reportDate": "2026-04-28",
  "reportTime": "14:30",
  "natureOfConcern": "disclosure",
  "details": "Report narrative goes here.",
  "immediateActions": ["Child removed from danger", "Civil authorities contacted"],
  "actionDetails": "Actions taken narrative.",
  "agency": {
    "name": "Alberta Child and Family Services",
    "phone": "1-800-387-5437",
    "reportedAt": "2026-04-28T20:45:00.000Z",
    "officialSpokenTo": "Intake worker name"
  },
  "signatures": {
    "reporterName": "Jane Volunteer",
    "reporterSignedDate": "2026-04-28",
    "supervisorName": "",
    "supervisorSignedDate": ""
  },
  "assignedLeadUid": null,
  "assignedLeadEmail": null,
  "leadNotes": "",
  "closedReason": "",
  "submittedBy": "firebase-user-uid",
  "submittedByEmail": "jane@example.com",
  "submittedAt": "server timestamp",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp",
  "updatedBy": null,
  "updatedByEmail": null,
  "migratedFromSubmissionId": null
}
```

### Indexes

Initial indexes:

- `status ASC, submittedAt DESC`: dashboard list by status.
- `assignedLeadUid ASC, status ASC, submittedAt DESC`: lead workload view.
- `legalHold ASC, submittedAt DESC`: legal hold review.
- `recordId ASC`: direct lookup.

Firestore will prompt for composite indexes if a query requires one. Add generated index specs to `firestore.indexes.json` once queries are final.

## Safeguard Lead Custom Claim

### Claim Shape

Use Firebase Auth custom claims:

```json
{
  "safeguard_lead": true
}
```

This is separate from the current Firestore profile `role`. A user can be a Coordinator without being a safeguard lead. A safeguard lead can also be represented in the visible profile for UI labels, but the security-critical check should use the custom claim.

### Who Can Set It

Only trusted server-side code can set custom claims. The client cannot write this claim directly.

Create a callable Cloud Function:

`setSafeguardLead({ uid, enabled, reason })`

Required caller checks:

- Caller is authenticated.
- Caller has `safeguard_lead_admin == true` custom claim, or caller UID is in a hardcoded emergency bootstrap allowlist during initial setup.
- Caller cannot modify themselves unless the function explicitly allows it and logs an elevated warning.
- Target user exists.
- Function writes an audit log entry for every grant/revoke.

Recommended claims:

- `safeguard_lead`: can read/list/update abuse reports through Cloud Functions.
- `safeguard_lead_admin`: can grant/revoke `safeguard_lead`. Keep this to one or two trusted people.

### Promotion Flow

1. A Coordinator identifies the person who should become Safeguard Lead.
2. A current `safeguard_lead_admin` opens a future admin role page.
3. The UI calls `setSafeguardLead({ uid, enabled: true, reason })`.
4. Function verifies the caller's claim.
5. Function calls Admin SDK `setCustomUserClaims`.
6. Function updates the user's visible `/users/{uid}` profile with `safeguardLead: true` for UI only.
7. Function writes `/auditLog/{id}` with action `safeguardLead.grant`.
8. Target user signs out/in or refreshes token so new claim appears.

Initial bootstrap:

- Use a one-time local/admin script run by the project owner after `firebase login`, or a temporary hardcoded bootstrap UID in the callable function.
- Remove bootstrap code immediately after the first `safeguard_lead_admin` is set.

## Cloud Functions Setup

Firebase's official docs currently state that you can emulate functions in any Firebase project, but deploying functions requires the Blaze pricing plan. Source: [Cloud Functions for Firebase get started](https://firebase.google.com/docs/functions/get-started). Firebase describes Spark as no-cost and Blaze as pay-as-you-go; upgrading links a Cloud Billing account to the project. Sources: [Firebase pricing](https://firebase.google.com/pricing), [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans).

Recommendation: upgrade to Blaze only when ready to implement F-01 server mediation. Blaze can incur cost. Before upgrading, set a Google Cloud budget alert and keep functions low-volume.

### Project Structure

Add:

```text
functions/
  package.json
  index.js
  .eslintrc.cjs
firebase.json
firestore.rules
firestore.indexes.json
```

Suggested functions:

- `createAbuseReport`: callable or HTTPS function used by `SG-FRM-007`.
- `listAbuseReports`: callable function for safeguard leads.
- `getAbuseReport`: callable function for a single report; writes read audit entry.
- `updateAbuseReport`: callable function for triage updates; writes update audit entry.
- `setSafeguardLead`: callable function for claim grants/revokes.
- `migrateLegacyAbuseReports`: admin-only callable or one-time script.

### Enable Cloud Functions

Chris steps:

1. Open Firebase Console.
2. Select project `safeguard-hub-71292`.
3. Open **Build > Functions**.
4. If prompted to upgrade, review Blaze pay-as-you-go terms.
5. Link a billing account.
6. In Google Cloud Billing, create a budget alert for this project before deploying functions.
7. Locally:

```bash
cd /Users/chrisprefontaine/Documents/Codex/2026-04-28/i-have-a-safegurad-program-i/safeguard-hub-auth
npx firebase-tools login
npx firebase-tools init functions
```

Choose JavaScript or TypeScript. For this repo, JavaScript is likely simplest.

Deploy commands:

```bash
npx firebase-tools deploy --only functions --project safeguard-hub-71292
npx firebase-tools deploy --only firestore:rules --project safeguard-hub-71292
```

If indexes are added:

```bash
npx firebase-tools deploy --only firestore:indexes --project safeguard-hub-71292
```

## Audit Log

### Collection

`/auditLog/{eventId}`

### Fields

- `eventType`: string enum, e.g. `abuseReport.create`, `abuseReport.list`, `abuseReport.read`, `abuseReport.update`, `abuseReport.export`, `safeguardLead.grant`, `safeguardLead.revoke`, `migration.copy`
- `actorUid`: string
- `actorEmail`: string
- `actorClaims`: map, minimal claim snapshot
- `targetCollection`: string
- `targetId`: string or null
- `targetRecordId`: string or null
- `requestId`: string or null
- `reason`: string
- `metadata`: map, no narrative PII
- `createdAt`: timestamp

### Who Writes

Cloud Functions should write audit entries using the Admin SDK. Clients should not write audit events directly because client-written audit logs can be bypassed or forged.

### Read Audit Strategy

Use Cloud Function-mediated reads for `abuseReports`:

- Client calls `getAbuseReport({ id, reason })`.
- Function verifies `safeguard_lead` claim.
- Function reads the report with Admin SDK.
- Function writes `auditLog` event `abuseReport.read`.
- Function returns the report.

Avoid client-direct reads for abuse reports. Firestore rules can restrict direct reads to safeguard leads, but they cannot reliably create a "read happened" audit entry. Direct reads should either be denied entirely or reserved for emergency break-glass tooling.

## Additive Firestore Rules Blocks

These are additive design blocks on top of PR #1's rules. Exact syntax should be validated in the Rules Playground before deployment.

```rules
function isSafeguardLead() {
  return request.auth != null
    && request.auth.token.safeguard_lead == true;
}

function isSafeguardLeadAdmin() {
  return request.auth != null
    && request.auth.token.safeguard_lead_admin == true;
}

match /abuseReports/{reportId} {
  // Preferred model: direct client reads are denied so Cloud Functions can
  // write read audit events. If an emergency direct-read path is approved,
  // change get/list to `if isSafeguardLead()` and document why.
  allow get, list: if false;

  // If SG-FRM-007 writes directly before Cloud Functions are ready, allow
  // create by verified signed-in users with strict schema validation. The
  // preferred final model is create through a Cloud Function as well.
  allow create: if false;

  // Triage updates should go through Cloud Functions to enforce audit logging.
  allow update: if false;

  allow delete: if false;
}

match /auditLog/{eventId} {
  // Written only by Cloud Functions/Admin SDK. Clients cannot create logs.
  allow create, update, delete: if false;

  // Optional: safeguard lead admins may inspect audit events in a future UI.
  allow get, list: if isSafeguardLeadAdmin();
}
```

If a transitional direct-create model is needed before Cloud Functions:

```rules
match /abuseReports/{reportId} {
  allow create: if request.auth != null
    && request.auth.token.email_verified == true
    && request.resource.data.formCode == 'SG-FRM-007'
    && request.resource.data.submittedBy == request.auth.uid
    && request.resource.data.submittedByEmail == request.auth.token.email
    && request.resource.data.status == 'open'
    && request.resource.data.submittedAt == request.time
    && request.resource.data.createdAt == request.time;

  allow get, list, update, delete: if false;
}
```

The transitional rule still does not solve read auditing. Use it only if the team needs to move `SG-FRM-007` writes before Cloud Functions are available.

## Admin UI Changes

### `admin-submissions.html`

Add a new tab or button:

- Label: `Abuse Reports`
- Visible only when the current user's ID token has `safeguard_lead == true`.
- Hidden from ordinary Coordinators.
- Do not show `SG-FRM-007` in the ordinary submissions table once migration is complete.

Implementation shape:

- Add helper `currentUser.getIdTokenResult(true)` to read claims.
- If `claims.safeguard_lead === true`, render the tab.
- The tab calls `listAbuseReports`.
- Clicking a row opens `admin-abuse-report.html?id=...`.

### New Page

`admin-abuse-report.html`

- Guard: signed-in, verified, `safeguard_lead == true`.
- Load through `getAbuseReport({ id, reason })`.
- Require a short reason before opening if policy wants explicit access purpose.
- Triage actions call `updateAbuseReport`.
- Avoid putting child name or report detail in URL, title, console logs, or notification text.

### Current `admin-submission.html`

After migration:

- If a legacy `SG-FRM-007` submission is opened by a non-safeguard lead, show "Restricted report migrated" with no details.
- If opened by a safeguard lead, redirect to `admin-abuse-report.html?id={newId}` using the migration map.

## Migration Plan

1. Freeze new `SG-FRM-007` submissions briefly, or deploy new write path first.
2. Run a migration function/script with Admin SDK:
   - Query `/submissions` where `formCode == "SG-FRM-007"`.
   - Transform each rowData array into the structured `abuseReports` schema.
   - Create `/abuseReports/{newId}` with `migratedFromSubmissionId`.
   - Update the old submission with:
     - `restricted: true`
     - `migratedToAbuseReportId: newId`
     - `rowData: []` or a redacted placeholder
     - `status: "migrated"`
   - Write `auditLog` event `migration.copy`.
3. Verify counts:
   - Number of legacy SG-FRM-007 submissions.
   - Number of new abuseReports.
   - Number of old submissions marked restricted/migrated.
4. Confirm ordinary Coordinator cannot list/read migrated report details.
5. Confirm Safeguard Lead can open migrated reports and audit entries are written.
6. Remove `SG-FRM-007` from ordinary `FORM_SCHEMAS`/submissions filtering once safe.

## Open Questions For Chris

These are policy decisions, not engineering decisions:

1. Who is the primary Safeguard Lead at Bethany?
2. Should there be a backup Safeguard Lead?
3. Who can grant or revoke Safeguard Lead access?
4. Should the Senior Pastor have access to suspected abuse reports by default, or only when assigned?
5. Should the Board Chair or Elders have access? If yes, always, or only by case?
6. Should reporters' identities be visible to all safeguard leads, or only to the assigned lead?
7. Should every read require a typed reason?
8. Should abuse reports be exportable at all? If yes, who can export and what watermark/audit controls are required?
9. What retention/legal hold period applies to suspected abuse reports?
10. Who is allowed to close a suspected abuse report?
11. Is there an emergency "break glass" access policy?
12. Should notifications go to personal email, church email, or only in-app?
13. Should mobile access be allowed for abuse reports, or restricted to trusted devices?
14. Should two-factor authentication be required before a user receives `safeguard_lead`?

## References

- Firebase Cloud Functions get started: https://firebase.google.com/docs/functions/get-started
- Firebase pricing: https://firebase.google.com/pricing
- Firebase pricing plans: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
