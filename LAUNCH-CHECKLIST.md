# Launch Readiness Checklist — Safeguard Hub

**Status:** Prototype. Not in production. Everything in the database today is
test data. This is the deliberate pass to do **before real volunteers use the
site.** None of it is urgent until you decide to go live.

> Account email addresses are intentionally **not** recorded in this file —
> this repo is public (GitHub Pages serves it), and personal addresses in a
> public repo get scraped. Keep the actual account emails in a private note.

---

## 1. Clear the test data

All current entries (forms, submissions, accounts) are throwaway testing.
Before launch, start from a clean slate.

- [ ] Delete test `submissions`, `abuseReports`, and test user accounts, **or**
      reset the Firestore data.
- [ ] (Optional) Run the migration tool once on dummy data first, just to watch
      it work — see `docs/abuse-report-migration-runbook.md`. Not required; the
      real value of that tool is preserving *genuine* abuse reports, of which
      there are none here.

---

## 2. Roles — assign deliberately

Roles are **separate jobs on purpose.** A Coordinator runs the volunteer/admin
side; a Safeguard Lead is the only role that can read suspected-abuse reports.
A Coordinator **cannot** see abuse reports — this separation is enforced and
covered by the rules tests.

| Role | What it can do | Who (current plan) | MFA |
| --- | --- | --- | --- |
| Volunteer | Their own profile + forms | Volunteers | Optional |
| Coordinator | Manage volunteers, applications, admin. **Cannot** read abuse reports | **Christin** | **Required** |
| Safeguard Lead | Read/manage suspected-abuse reports | **Chris (interim)** | **Required** |
| Safeguard Lead Admin | Grant/revoke Safeguard Lead access to others | **Chris (interim)** | **Required** |

- [ ] Set Christin as **Coordinator** (a one-field change on her account; no
      rebuild needed).
- [ ] Confirm the **Safeguard Lead** decision deliberately. Chris holding it for
      now is fine for the early phase, since he also maintains the site.
- [ ] **Revisit before scaling:** ideally name a *second* Safeguard Lead (so
      there's a backup), and over time separate "person who maintains the site"
      from "person who reads abuse reports" — that separation of duties is the
      safer long-term setup. Align the final choice with your church's /
      denomination's child-protection guidance.

---

## 3. MFA (two-factor login)

**Rule of thumb: anyone above a normal volunteer must use MFA** — Coordinator,
Safeguard Lead, and Lead Admin.

- [ ] Enable MFA in Firebase. This requires upgrading to the **Blaze**
      (pay-as-you-go) plan — at this scale the cost is effectively nil.
- [ ] Enrol MFA on the Coordinator, Safeguard Lead, and Lead Admin accounts.

> The security rules already assume this: a user **cannot** be granted
> Safeguard Lead unless MFA is enabled on their account.

---

## 4. Before-launch review (do once)

- [ ] Test data cleared (Section 1).
- [ ] Roles assigned, with MFA on privileged accounts (Sections 2–3).
- [ ] Privacy notice present (`privacy.html`) and a plain "how long we keep
      records" retention policy written (`RETENTION.md`).
- [ ] Someone owns **backups** (a periodic Firestore export).
- [ ] Sanity-check access with the rules tests: `npm run test:rules`
      (65 tests confirm who can and cannot see what).

---

## 5. Verification already in place

- **Firestore rules tests** — `npm run test:rules` (see
  `docs/firestore-rules-tests.md`). Proves the access model, including that
  Coordinators can't read abuse reports and volunteers can't escalate their own
  role.
- **Abuse-report migration tool + runbook** — ready if real reports ever need
  relocating out of the general collection.
