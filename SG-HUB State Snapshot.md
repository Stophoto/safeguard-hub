# SG-HUB State Snapshot

*As-of: 2026-06-21 · Project: `safeguard-hub-71292` · Served at `stophoto.github.io/safeguard-hub`*
*Status: working prototype. All data in the system today is test data — not yet in production.*

This describes **what the Safeguard Hub IS right now**, so an outside collaborator is oriented in five minutes. It is a state document, not a changelog.

---

## 1. Architecture

- **Frontend:** static HTML/CSS/JS on **GitHub Pages**. No bundler, no build step.
  - Most pages are **plain vanilla JS** + shared ES modules (`sg-*.js`).
  - **One page uses React:** `index.html` (the Hub landing / document library) renders a `SafeguardHub` component via `React.createElement` — **no JSX, no build**; React + ReactDOM are **vendored locally** in `/vendor`.
- **Backend:** **Firebase.** Firestore holds all app data; Firebase Auth handles accounts. No server of our own except one **staged** Cloud Function (see §3).
- **Apps Script / Sheets:** **retired as the app backend.** The *only* surviving use is the "Have a question?" help form → an Apps Script web app (`BACKEND_URL` in `sg-nav.js`) that emails the administrator and optionally logs to a "Help Questions" Sheet tab. The recipient address lives only server-side.
- **Auth model:** Firebase email/password + mandatory email verification. **Role comes from the Firestore profile doc** (`users/{uid}.role`), enforced by Firestore rules. (Custom claims exist only in the staged invite function.)
- **Hosting:** GitHub Pages from repo root (public repo).

**Changed from the baseline you gave:**
| Baseline assumption | Reality now |
| --- | --- |
| vanilla-JS **React** | Only `index.html` is React (createElement, vendored). Everything else is vanilla JS. No JSX/build. |
| **Google Sheets + Apps Script** backend | Replaced by **Firestore**. Apps Script remains only for the help-question contact form. (Legacy Sheets-password path was removed — see F-02.) |
| Firebase Auth **(Blaze)** | Firebase Auth is live, but the project is **not on Blaze yet**. Blaze is still pending and gates Cloud Functions + MFA. |
| **WebAuthn passkeys** | **Not present anywhere** — no passkey/WebAuthn code exists. The only "2FA" is a manual coordinator note flag (`mfaEnrolled`); Firebase MFA is planned post-Blaze. |

---

## 2. What's live

Deployed on GitHub Pages, backed by Firestore, working today:

- **Hub landing** (`index.html`) — the React document library: Governance (1), Core Policies (4), Forms (11), SOPs (7), Training (8 modules across volunteer/leader tracks) + reference; some inline fillable forms.
- **Auth pages** — `sign-up`, `sign-in`, `verify-email`, `forgot-password`.
- **Volunteer dashboard** (`dashboard.html`) — live onboarding progress computed from the Firestore profile (profile, covenant, police check, references, training), warm welcome copy, help button.
- **Profile setup** (`profile-setup.html`) — the live default onboarding form.
- **Fillable forms → Firestore** via `createSubmission(...)`: covenant (sign-once), police-check submit, references submit, training module completion, incident report (SG-FRM-006), child registration (SG-FRM-005), ministry application (SG-FRM-001), reference check (SG-FRM-002).
- **Coordinator admin** (gated to `role === "coordinator"` by rules):
  - **People** (`admin.html`) — roster, stats, role/status pickers, activation queue, CSV export, invite.
  - **Screening** (`admin-screening.html`) — pipeline by stage.
  - **Submissions** (`admin-submissions.html`) — all forms; abuse reports gated to Safeguard Lead.
  - **Tasks** (`admin-tasks.html`) — static placeholder rhythm list (slated for replacement).
  - **Room Kit** (`admin-room-kit.html`) — classroom printables.
  - **Individual record** (`admin-user.html`) — record interview/approval/ministry, mark police-check cleared, mark references received, edit profile, activate.
- **Abuse reports** (SG-FRM-007) — separated into the `abuseReports` collection, **Safeguard-Lead-only** (`admin-abuse-report.html`).
- **Help / "Have a question?"** modal (`sg-nav.js`) → Apps Script email (the one live Apps Script path).
- **Privacy page**; shared role-aware nav with mobile collapse.
- **Firestore security rules** are the real access control, covered by **65 emulator tests** (`npm run test:rules`).

---

## 3. What's built but not live

- **Server-side invite + activation** (the "ready-to-deploy" scaffold):
  - `functions/index.js` → **`createInvitedUser`** (callable): server-creates the Auth account, sets `{role, ministryArea}` custom claims, writes an `invited` profile stub, generates an activation link. **Not deployed** — `firebase.json` has no `functions` block, needs **Blaze**, and the **mail sender is stubbed** (throws). Deploy steps in `functions/DEPLOY-SNIPPETS.md`.
  - `activate.html` — set-password / Google-SSO page that flips `invited → activated`. Built; depends on the function **and** a `validActivationSelfUpdate` rule that is **not yet applied**.
  - `prospects` collection + prospect→invited carry-over — referenced **only** inside the function; no UI creates prospects.
- **Onboarding wizard** (`onboarding.html` + `sg-wizard.js`) — the newer multi-step application/onboarding flow (writes profile + `application` marker + a People submission). Reachable directly, but the live routers (`routeAfterLogin`, dashboard) still send incomplete profiles to `profile-setup.html`, so it is **not the default path yet**.
- **Custom-claims role model** — used only by the staged function; the live app still reads role from the profile doc.
- **Microsoft SSO** — button on `activate.html` is disabled ("coming soon"); Google SSO is wired.
- **Admin Dashboard redesign** — planned; hand-off doc exists (`docs/admin-dashboard-handoff.md`, draft **PR #10**). Replaces the static Tasks page with a live triage + rhythm-with-memory home; needs a small `adminRhythm` collection + rule. **Not built.**
- **Email delivery** generally — no provider wired anywhere; invites today rely on the coordinator's own email client.

---

## 4. Data layer (Firestore)

**Collections** (per `firestore.rules`):

- **`users/{uid}`** — profile + all compliance state (the heart of the app). Key fields:
  - Identity/role: `email`, `role` (volunteer|leader|coordinator), `status`, `safeguard_lead`, `safeguard_lead_admin`, `mfaEnrolled`, `profileComplete`.
  - Personal: `firstName/lastName/preferredName/dob/phone/address`, `emergencyContact`.
  - Ministry: `programs`, `childrenAreas`, `serviceTimes`, `ageGroups`, `attendingSince`, `testimony`.
  - Application marker: `application { submittedAt, recordId, isYouth }` (full app lives in a submission).
  - Compliance: `covenant { signed, signedAt, signatureName, expiresAt }` (+ `covenantHistory[]`); `policeCheck { submittedAt, clearedAt, expiresOn }` + `renewalDueOn`; `references.items[] { name, email, relationship, receivedAt }`; `training { "SG-T-00X": { completedAt } }`.
  - Screening: `screening { interview, approval, ministryAssigned }`.
  - Audit: `activatedAt/activatedBy`, `updatedAt/updatedBy`.
- **`submissions/{id}`** — every fillable form except abuse. Shape: `formCode`, `formTitle`, `recordId`, `rowData[]`, `submittedBy`, `submittedByEmail`, `submittedAt`, `status` (open|reviewed|closed). Types in use: SG-FRM-001/002/005/006/012. *(The `tabName`/`rowData` vocabulary is legacy Sheets-row shape, now persisted to Firestore.)*
- **`abuseReports/{id}`** — SG-FRM-007 suspected abuse; Safeguard-Lead-only; `legalHold: true` by default.
- **`invites/{id}`** — coordinator-created invite records (live flow): `email`, `suggestedMinistry`, `note`, `status`, `invitedBy…`.
- **`leadNotifications/{id}`** — notices to Safeguard Leads (e.g., temporary abuse-access grants).
- **`config/{id}`** — coordinator-readable config (`write: false`).
- *(`prospects/{id}` — referenced by the staged function only; no live rule or UI.)*

**Apps Script endpoint:** one web app `doPost` routing `help_question` → email admin + optional "Help Questions" Sheet tab.

**Cloud Functions:** `createInvitedUser` (callable, `us-central1`) — **built, not deployed**; mail hook stubbed.

**Owner-run scripts:** `scripts/bootstrap-safeguard-lead-admin.mjs` (set first Lead Admin), `scripts/migrate-legacy-abuse-reports.mjs` (relocate legacy SG-FRM-007 out of `submissions`).

**Tests:** `tests/*.test.mjs` — 65 Firestore-rules tests (emulator only).

---

## 5. Auth & access

- **Accounts:** Firebase email/password; **email verification required** before protected pages. Password reset + resend verification present.
- **Volunteer lifecycle — two vocabularies (not yet reconciled):**
  - **Live profile status** (admin/dashboard): `in-process → active → paused → inactive`. "Ready for activation" = all 5 onboarding steps done while still `in-process`; coordinator clicks **Activate** (→ `active` + `activatedAt`).
  - **Screening sub-state** (SG-SOP-001, coordinator-recorded): `not-started → interview-done → approved` (or `declined`) `→ ministry-assigned`.
  - **Staged invite path** adds `invited → activated` (Cloud Function + `activate.html`) — **not recognized by the live admin status UI.**
- **Onboarding steps** (computed live from profile): profile · Worker's Covenant (sign-once) · Police Information Check (volunteer submits → coordinator clears; 3-yr validity → `renewalDueOn`) · two references (volunteer submits → coordinator marks received) · training (4 core; +3 leader modules for leader/coordinator).
- **Role tiers:** `volunteer | leader | coordinator` plus `safeguard_lead` / `safeguard_lead_admin` flags. `isCoordinator()` reads `profile.role`. **Coordinators cannot read abuse reports** — only Safeguard Lead can; Lead Admin grants/revokes Lead. Rules **forbid granting Lead unless `mfaEnrolled`**.
- **2FA / MFA:** **not enforced in software.** `mfaEnrolled` is a manual coordinator note. Plan: enable Firebase MFA after Blaze (required for Coordinator/Lead/Lead Admin). **No WebAuthn/passkeys.**
- **Invite flow:**
  - **Live:** coordinator creates an `invites` record + emails from their own client (mailto handoff); volunteer self-signs-up → verifies → onboarding.
  - **Staged:** `createInvitedUser` server-creates account + claims + activation link (`activate.html`). Awaiting Blaze + deploy + a mail provider.

---

## 6. Known issues / tech debt

- **Blaze not enabled** → blocks Cloud Function deploy (invites) **and** Firebase MFA. (`functions` block missing from `firebase.json`; activation self-update rule not applied.)
- **No email delivery wired** anywhere — invites/activation depend on copy-link / mailto. Function mail hook is a stub that throws.
- **Two status vocabularies** (`invited/activated` vs `in-process/active/...`) not reconciled — staged activation writes statuses the admin UI doesn't display.
- **Onboarding wizard not the default route** — routers still point incomplete profiles to `profile-setup.html`.
- **Dual role source** — `profile.role` (live) vs custom claims (staged); unify when functions go live (F-10).
- **Security backlog** (`SECURITY_REVIEW.md`) still open: **F-08** no durable audit log (role/status/export/triage/clearance/abuse-views); **F-09** no idle timeout / shared-device cleanup; **F-01** Phase A has no reliable abuse-report read-audit (**must** be fixed before real volunteers); **F-05** CSV export PII (has confirm, still no audit/minimization); **F-06** some `localStorage` PII drafts remain (SG-FRM-005 fixed); **F-11** UIDs in admin URLs; **F-16** CSP still uses `unsafe-inline` and meta `frame-ancestors` (needs real HTTP headers). *Resolved:* F-13 (mailto PII), F-14 (privacy page), parts of F-16/F-06.
- **Retention is manual** (`RETENTION.md`) — DOB not normalized; no auto-retention; abuse reports `legalHold` by default with no deletion path.
- **Off-site / transportation** forms (SG-FRM-009/010/011, SG-SOP-007) exist as documents but are **not tracked** anywhere in admin.
- **Admin · Tasks** is a stale static placeholder (predates sign-once covenant / 3-yr checks) — slated for replacement.
- **Everything is test data** — prototype, not production.

---

## 7. Open decisions (awaiting your call)

- **Go-live trigger** — when to clear test data and open to real volunteers (`LAUNCH-CHECKLIST.md` §1/§4).
- **Enable Blaze?** — gates Cloud Functions + MFA (cost ~nil at this scale).
- **Email provider** for invites/activation — SendGrid / Mailgun / Gmail API (function stub awaits the choice).
- **Invite model** — keep the live mailto flow, or switch on the server-side `createInvitedUser` flow.
- **Onboarding** — make the wizard the default, or keep `profile-setup.html`.
- **Roles** — confirm **Christin = Coordinator**; confirm **Safeguard Lead** (Chris interim) and name a backup/second Lead; long-term, separate "site maintainer" from "abuse-report reader."
- **MFA rollout** on privileged accounts (after Blaze).
- **Microsoft SSO** — enable (needs Entra registration) or drop.
- **Backups owner** — who runs periodic Firestore exports.
- **Admin Dashboard redesign** — approve the hand-off plan (PR #10) + the small `adminRhythm` store/rule before build.
- **Rules deployment is owner-gated** — do not publish `firestore.rules` without explicit approval.
