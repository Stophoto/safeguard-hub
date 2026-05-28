# Firestore Security-Rules Tests

These tests verify **who can read, list, update, and delete** the two
sensitive collections — `submissions` and `abuseReports` — for every role.
They run entirely against the **Firestore emulator** using a `demo-` project
id, so they never touch production data or require any credentials.

## Run

```bash
npm install            # one-time: installs firebase-tools + rules-unit-testing
npm run test:rules
```

`test:rules` boots the Firestore emulator (`firebase emulators:exec --only
firestore`) and runs `node --test tests/`. Requires Java (for the emulator)
and Node 18+.

## What is covered

Roles are independent flags on each user's own `/users/{uid}` profile:
`role == 'coordinator'`, `safeguard_lead == true`, `safeguard_lead_admin == true`.

| Capability | unauth | volunteer | coordinator | Safeguard Lead | Lead Admin\* |
| --- | :--: | :--: | :--: | :--: | :--: |
| `submissions` get (own) | ✗ | ✓ | ✓ | ✓ (if owner) | ✓ (if owner) |
| `submissions` get (others') | ✗ | ✗ | ✓ | ✗ | ✗ |
| `submissions` list | ✗ | ✗ | ✓ | ✗ | ✗ |
| `abuseReports` get | ✗ | ✗ | **✗** | ✓ | **✗** |
| `abuseReports` list | ✗ | ✗ | **✗** | ✓ | **✗** |
| delete (either) | ✗ | ✗ | ✗ | ✗ | ✗ |

\* "Lead Admin" here means `safeguard_lead_admin == true` **without**
`safeguard_lead == true`. The tests prove admin-ness alone does **not** grant
abuse-report reads — a Lead Admin must also be a Lead to read reports.

Highlighted properties:

- **The exposure:** a coordinator *can* read a legacy `SG-FRM-007` record while
  it sits in `submissions`, but *cannot* read it once it lives in
  `abuseReports`. This is exactly what the migration
  (`docs/abuse-report-migration-runbook.md`) closes.
- **Least privilege for abuse reports:** only `safeguard_lead == true` grants
  read/list — not coordinator, not Lead Admin.
- **Temporary access:** a time-boxed `temporaryAbuseAccess` grant lets a user
  read the *one* report named in the grant, but not others, and never list.
- **Create boundaries (sanity):** a verified user can create a submission only
  as themselves; impersonation and unverified-email creates are rejected.

## Notes

- The suite seeds data with `withSecurityRulesDisabled` (admin context), then
  exercises the rules through per-role authenticated contexts.
- It does not (yet) cover the full `users` self-update / coordinator-update /
  safeguard-access-update matrix, or the `invites` / `config` /
  `leadNotifications` collections. Those are natural follow-ups.
