# Execution Plan — Safeguard Hub 30-Day Launch

_Builder-facing spec. Written 2026-07-02 on branch `claude/code-security-review-q484cp`._
_Owner-facing summary: `LAUNCH-PLAN.md` (repo root). Findings labels (S-x, B-x, U-x) refer to that file._

## How to use this document (instructions for the executing model/person)

This plan is **self-contained**: it assumes no prior chat context. Decisions are
already made and recorded below — do not re-litigate them; if something is truly
ambiguous, ask the owner (a non-coder; use plain language).

Ground rules for every work package:

1. Work on branch `claude/code-security-review-q484cp`; push to it; PR #12 tracks it.
2. **Never deploy anything.** No `firebase deploy`, no rules publishing, no Firebase
   console changes, no production data. The owner deploys (runbook in WP-9).
3. After ANY change to `firestore.rules` or `tests/*.test.mjs`, run
   `npm run test:rules` (needs Java + `npm install` once) — all tests must pass.
   After ANY change to a `sg-*.js` file, run `node --check <file>`.
4. ⚠️ `firestore.rules` `validUserSelfUpdate` and its `validSelf*` helpers are close
   to Firestore's **1000-expression evaluation cap** (one deny-path test already
   evaluates to the cap and denies by exhaustion — fail-closed, acceptable). Do NOT
   add expressions to the self-update chain without removing some; re-run tests and
   watch for `maximum of 1000 expressions` on *success* paths (that would break
   legitimate saves).
5. Do not restyle pages (a separate visual redesign lives in PR #11, undecided).
   Keep diffs functional and minimal; match each file's existing code style.
6. Every user-visible string you write must be plain language — no codes, no
   Firebase jargon, no developer terms. The audience is church volunteers.

## Locked owner decisions (2026-07-02)

- **D-1**: Abuse reports readable by **Chris AND Christin** (both get `safeguard_lead`
  + `safeguard_lead_admin` + real MFA). Future readers (elders, Sr Pastor Paul,
  Pastor of Ministries Jay) get **`safeguard_lead` only** — read access without the
  ability to grant access or change settings. No code needed for that future step;
  the model already supports it.
- **D-2**: Role changes (who is Coordinator/Leader/Volunteer) are **owner-tier only**
  (`safeguard_lead_admin`, i.e. Chris + Christin), never on one's own account.
  Coordinators cannot promote anyone. **Implemented + tested** (see WP-1).
- **D-3** (default, owner may override): "Save & finish later" in the onboarding
  wizard is fixed by **honest labeling** (option a in WP-3), not by persisting
  sensitive draft answers to the browser.

## Status ledger

| WP | Scope | Status |
| --- | --- | --- |
| WP-1 | Phase 1 rules lockdown + tests | **DONE** (90/90 tests pass) |
| WP-2 | B-6 undo no-ops | **DONE** |
| WP-3 | Phase 2 correctness bugs | todo |
| WP-4 | Phase 2 rule-adjacent copy/flow fixes | todo |
| WP-5 | Phase 3 UI quick wins | todo |
| WP-6 | Phase 3 performance | todo |
| WP-7 | Phase 3 admin scale | todo |
| WP-8 | Cleanup / dead code | todo |
| WP-9 | Owner runbook (deploy, MFA, Christin, bootstrap removal) | owner + assistant |
| WP-10 | Phase 2 email verification re-enable | blocked on owner email decision |

---

## WP-1 — Rules lockdown (DONE — do not redo; recorded for context)

Implemented in `firestore.rules` + both test files, all on this branch:

- Coordinators can no longer change `role` (any role change now requires
  `safeguard_lead_admin`, on someone else's account, as its own write of
  `role`+`updatedAt`+`updatedBy` — see `validRoleChangeUpdate`).
- Coordinators cannot edit their **own** user document via the coordinator path
  (self-exclusion) — no self-clearance/self-approval/self-activation. Their own
  personal fields still work via the volunteer self path.
- Coordinator `status` writes are enum-checked
  (`in-process|active|paused|inactive|invited`).
- Safeguard access grants (`validSafeguardAccessUpdate`): self-grants blocked;
  `safeguard_lead_admin` now requires `mfaEnrolled` just like `safeguard_lead`.
- Temporary abuse access (`validTemporaryAbuseAccessUpdate`): self-grants blocked.
- B-1: `validSelfPoliceCheck` only evaluates when `policeCheck` is touched; allows
  the coordinator-written `followUpAt` key; pins `clearedAt`/`expiresOn`/`followUpAt`;
  caps `submittedAt` at 40 chars. Client counterpart: `sg-profile.js
  submitPoliceCheck` now preserves `followUpAt`.
- B-2: received references are locked (name/email/relationship/receivedAt pinned,
  cannot be removed); `references` map allows only `items`; per-item size caps.
- UI counterparts: `admin.html` + `admin-user.html` disable role pickers for
  non-Lead-Admins and self; confirm dialogs on role change and active→away status
  changes (U-7); self compliance/screening/access controls disabled with a
  plain-language note; `sg-admin.js updateUserProfile` strips `role` and omits
  `updatedBy` on self-writes; role changes go through `setUserRole` as their own write.

Verification (already passing, keep green): `npm run test:rules` → 90 tests.

## WP-2 — Undo no-ops (DONE — recorded for context)

`sg-admin.js`: `unclearPoliceCheck`, `setPoliceFollowUp(off)`,
`clearScreeningInterview`, `clearScreeningApproval`, `clearMinistryAssignment` and
`sg-profile.js unmarkTrainingComplete` now use `updateDoc` + `deleteField()` on
dotted paths (merge writes cannot delete map keys — the old code showed success
while deleting nothing).

---

## WP-3 — Phase 2 correctness bugs (todo)

### WP-3.1 — B-7: "Save & finish later" loses wizard answers
**Decision D-3: honest labeling (default).**
- File: `sg-wizard.js`. The auto-save (`profilePayload`/`persist`, ~lines 838–881)
  saves only basic profile fields; Safety Screening answers, References,
  Ministry Experience, and Declarations live only in memory.
- Change the "Save & finish later" flow (`saveLater`, ~lines 828–833) and its
  toast/copy so it says what is true, e.g.: "Your profile details are saved.
  The screening questions, references and declarations aren't saved as a draft —
  when you come back, you'll re-enter anything left blank." Also add a short note
  near the wizard's start: best finished in one sitting (~10 minutes).
- Do NOT add localStorage persistence of screening answers (sensitive
  self-disclosures; shared-device risk — same reasoning as F-06/S-11).
- Acceptance: no wizard copy promises "we'll pick up right here" unless the data
  actually persists; `node --check sg-wizard.js` passes.

### WP-3.2 — B-9a: volunteer dashboard shows an expired police check as "Done"
- File: `dashboard.html`, `buildSteps` (~lines 420–432). It marks the police step
  done whenever `policeCheck.clearedAt` exists.
- Change: if `policeCheck.expiresOn` is in the past, the step is NOT done — state
  `pending` with detail like "Expired <date> — a new check is needed". Mirror the
  date handling used in `admin-dashboard.html`'s lapsed-check logic.
- Acceptance: with a seeded profile whose `expiresOn` < today, the dashboard step
  shows renewal needed, not "Done".

### WP-3.3 — B-9c: `removeUser` aborts cleanup on legacy abuse-report rows
- File: `sg-admin.js` `removeUser` (~line 135): the loop `continue`s on
  `SG-FRM-006` but not `SG-FRM-007`; rules reject that delete, the throw hits the
  catch and abandons remaining deletions.
- Change: also `continue` when `formCode === "SG-FRM-007"`.

### WP-3.4 — reviewer re-stamping on already-reviewed submissions
- File: `sg-submissions.js` (~lines 195–199). Saving a note on an already-reviewed
  submission overwrites `reviewedBy/reviewedAt` with the current editor.
- Change: only set `reviewedBy/reviewedByEmail/reviewedAt` when the submission is
  transitioning FROM `open`. Note: `firestore.rules validSubmissionUpdate` requires
  `reviewedAt == request.time` whenever status != open — so to preserve the original
  reviewer you must relax that rule branch to also accept unchanged
  `reviewedBy/reviewedAt` values (`unchanged('reviewedBy') && unchanged('reviewedAt')`
  as an alternative). ⚠️ Rules change → run `npm run test:rules`; add a test:
  second coordinator saving a note does not become the reviewer.

### WP-3.5 — B-8/S-8: `activate.html` writes a status the rules reject
- File: `activate.html` (~lines 100–109): after password set, it calls
  `saveProfile({ status: "activated", activatedAt: ... })` — self status writes are
  forbidden and `"activated"` isn't a real status. Dormant until the Cloud-Function
  invite path is enabled, but fix now:
- Change: remove the status/activatedAt write entirely. After password set +
  sign-in, route by profile like sign-in does (`routeAfterLogin`). The status stays
  `invited` until a coordinator activates them (admin flow already exists).
- Also: `functions/index.js` authorizes via `auth.token.role` custom claim, but the
  live app defines coordinators by the Firestore profile field. Inside
  `createInvitedUser`, replace the claim check with a Firestore read of
  `users/{auth.uid}.role === 'coordinator'` (keep the claim check as an OR for
  forward-compat). Mark the file header "Phase B — not deployed".
- Acceptance: `node --check` both files; no self status writes remain
  (`grep -n "status.*activated" activate.html` returns nothing).

### WP-3.6 — help endpoint: formula injection + dead recipient
- File: `apps-script/help-endpoint.gs`.
- Change (a): when appending user text to the Google Sheet, prefix any cell value
  starting with `=`, `+`, `-`, or `@` with a single quote `'` to neutralize
  spreadsheet formulas.
- Change (b): `HELP_RECIPIENT` is a placeholder — leave the code, but add a loud
  top-of-file comment + add "set the real help email" to WP-9 owner runbook (until
  then help messages silently go nowhere).
- Optional (c): add a hidden honeypot field check + reject bodies > 5000 chars.

## WP-4 — Phase 2 copy/flow fixes (todo)

### WP-4.1 — U-5a: sign-up button lies
- `sign-up.html` (~line 123): button says "Send verification email"; no email is
  sent (verification is off). Relabel to "Create account →" and remove/replace any
  "verify" copy on the page (~line 107) with what actually happens ("you'll go
  straight to your onboarding").

### WP-4.2 — U-6: stranded "Step X of 4" labels
- Remove the fixed step labels: `sign-up.html` (~105), `verify-email.html` (~101),
  `profile-setup.html` (~135). The real flow goes sign-up → onboarding wizard
  (which numbers its own steps).

### WP-4.3 — orphaned `verify-email.html`
- Nothing routes to it and no verification email is ever sent; it polls forever.
  Delete the page AND the stale comment in `sg-guard.js` (~line 24) that claims
  unverified users are redirected there. Grep for `verify-email` across the repo
  and remove/repoint every reference. (When email verification returns in WP-10,
  the page comes back properly.)

### WP-4.4 — U-5b: reference-request email contradiction
- `references.html`: page copy (~145) promises "a pre-written email asking for a
  short written reference (Coordinator copies you)", but the mailto body
  (~317–319) tells the referee NOT to reply with details and CCs nobody (that was
  a deliberate privacy choice — F-13).
- Change the on-page description to match reality: the email just gives the
  referee a heads-up; the Coordinator will contact them directly. Do NOT put
  personal details back into the mailto body.

### WP-4.5 — U-3: raw error text + dead-end failures (highest-value quick win)
- Route auth/Firestore errors through `friendlyError` (`sg-auth.js`) or a new
  small `friendlyLoadError(err)` helper for Firestore permission/network errors;
  never show `err.message` verbatim to volunteers.
- Files/lines to fix: `activate.html` 138/147/156; `sg-wizard.js` 832/932;
  `police-check.html` 307; `covenant.html` 268; `references.html`, `training.html`,
  `dashboard.html` (same "Couldn't load… + err.message" pattern);
  `admin.html` 232/358/373; `admin-dashboard.html` 383/455/491/538 (replace
  `alert()` with the inline `.msg` pattern used elsewhere).
- On load failures add a "Try again" button (re-runs the loader) and a link that
  opens the existing help modal (`window.SGHelp.open()`).
- Acceptance: `grep -n "err.message" *.html sg-*.js` shows no user-facing raw
  passthrough on volunteer pages (admin pages may keep detail AFTER a friendly
  sentence).

## WP-5 — Phase 3 UI quick wins (todo)

### WP-5.1 — U-1: internal codes shown to users
- Replace user-facing "SG-FRM-xxx"/"SG-T-xxx" labels with plain names:
  `dashboard.html` 442 (references link text), `covenant.html` 141,
  `police-check.html` 171, `references.html` 130, `training.html` 315,
  `admin-submissions.html` 257 (filter buttons → "Ministry Applications (3)" etc.),
  `sg-wizard.js` 653.
- KEEP codes in: the small document-control footer (`sg-nav.js` 557–568), admin
  detail views, and printable form headers — those are legitimate registry uses.
- Suggested names: SG-FRM-001 "Ministry Application", 002 "Reference",
  004 "Acknowledgement", 005 "Child Registration", 006 "Incident Report",
  012 "Training Log". (007 never appears in coordinator UI.)

### WP-5.2 — U-2: low-contrast text (one-file fix)
- `sg-theme.css` (~lines 27–31): `--muted:#8A97A0` (~3.0:1) and link/eyebrow blue
  `#159BD4` (~3.1:1) fail WCAG AA. Change `--muted` → `#5B6770`; add/darken a link
  color token → `#0E6FA3` for text links + eyebrows; keep `#159BD4` for large
  fills/bars only. Verify every usage still reads (grep the two hexes).

### WP-5.3 — U-4: covenant starts at "Section 2"
- `covenant.html` (~line 167): first heading is "Section 2 · Commitment to Child
  Protection"; there is no Section 1. Renumber the existing sections to start at 1
  (confirm with owner nothing was actually lost — flag it in the PR description).

### WP-5.4 — U-9/B-5: discarded personalized welcome
- `dashboard.html` `renderWelcome()` (~334–369): it computes a personalized
  `para2` then overwrites with generic text, and references a non-existent
  `#welcomeTitle`. Render the computed text; delete the dead reference.

### WP-5.5 — B-5 assorted small lies
- `admin-dashboard.html` ~275: "Last synced just now" is hardcoded — replace with
  the actual load time (store `new Date()` at load; format like other dates).
- `sg-wizard.js` 155/161: section eyebrows out of order ("Section 8" before
  "Section 7") — renumber.
- `references.html` 250–259: after saving both referees the counter shows
  "0/2 · received" (counts coordinator-received only) — add a separate "Saved ✓"
  state so a successful save doesn't look like a failure.

### WP-5.6 — U-11: disabled Microsoft sign-in buttons
- Hide (don't just disable) the "Continue with Microsoft" buttons until the
  integration exists: `sign-up.html` 132, `sign-in.html` 140, `activate.html` 72.

### WP-5.7 — hardcoded origin sweep (custom domain)
- The site now serves at `https://safeguard-hub.com` (see `CNAME`), but hardcoded
  `https://stophoto.github.io/safeguard-hub/...` URLs remain, e.g.
  `admin-user.html` welcome-email body (~974) and `functions/index.js
  ACTIVATE_URL` (~31). Grep `stophoto.github.io` and replace with the custom
  domain (relative links where possible).

## WP-6 — Phase 3 performance (todo)

### WP-6.1 — U-12: blank screen until Firebase answers
- Static, non-personal content (policy text, SOP text, covenant text, police-check
  how-to steps, training module text) must render immediately; only the personal
  status strip waits for auth.
- Mechanics: pages using `sg-guard.js` hide the whole `<body>` via
  `<style id="sg-guard-style">`. Change the pattern so the guard only gates a
  personal container (`#personal`/status blocks) and shows a lightweight skeleton
  in it; body stays visible. Redirect-on-signed-out behavior stays.
- The five volunteer pages (`covenant/police-check/references/training/dashboard`)
  hide `#view` behind a text "Loading…" — replace with a skeleton/spinner and show
  static instructions immediately.
- ⚠️ Do not weaken security: none of this content is confidential (policies/SOPs
  are printable handouts), and all real data stays behind Firestore rules. If in
  doubt for a given page, gate only the data, never the instructions.

### WP-6.2 — U-8: double font loading
- Every page loads DM Serif + DM Sans (old brand) in `<head>`, then the theme
  swaps to Archivo + IBM Plex Sans (via CSS `@import` + `sg-nav.js` injection).
  Remove the DM links and the `@import`; add ONE `<link>` for
  Archivo + IBM Plex Sans with `<link rel="preconnect" href="https://fonts.gstatic.com">`;
  drop the fragile `integrity` attribute on Google Fonts CSS (Google serves
  browser-specific CSS; hash mismatches silently kill fonts).

### WP-6.3 — U-10: theme flash
- Pages that get `sg-theme.css` injected at runtime by `sg-nav.js` (dashboard,
  onboarding, profile-setup, invite, admin-*) paint old colors first. Add a static
  `<link rel="stylesheet" href="sg-theme.css">` in each `<head>` (keep the runtime
  injection as no-op fallback) and align inline `:root` fallback tokens with the
  new palette.

### WP-6.4 — U-14: profile read 3–4× per page
- `sg-profile.js getOrCreateProfile()` hits Firestore every call; on one page it's
  called by the page, the user chip, and `sg-nav.js` (twice). Memoize per uid:
  cache the promise in module scope keyed by `auth.currentUser.uid`; invalidate on
  auth change and after `saveProfile`. Verify the wizard's create-stub race
  disappears (two parallel calls → one create).

## WP-7 — Phase 3 admin scale (todo, needed before ~200 users)

- `sg-admin.js listUsers()`: add pagination (`limit(100)` + `startAfter`) or
  server-side name search; roster UI gets a search box + "Load more".
- `admin.html`: after a role/status change, update the one row in place instead of
  `loadAndRender()` re-reading the whole collection.
- Stat tiles: use `getCountFromServer` aggregations (pattern already exists in the
  abuse-report code) instead of counting a full download.
- `admin-submissions.html` 228/236: the 500-row cap silently falsifies counts —
  page the list; get totals from count aggregations.
- `admin-screening.html` ~49: table wrapper `overflow:hidden` clips the "Open →"
  column on phones — `overflow-x:auto` (or stack to cards under 600px).

## WP-8 — Cleanup (todo, low risk)

- Delete `sg-admin-nav.js` (never referenced) — verify with grep first.
- `sg-profile.js`: covenant is sign-once — remove the unused 365-day `expiresAt`
  write in `signCovenant`, the dead `due-soon`/`expired` branches in
  `computeOnboarding`, and the dangling `"· renews " + formatDate(null)` string.
- Decide `leader` role: it grants nothing in rules (cosmetic + 3 extra training
  modules). Either document that in README or remove the option from role pickers.
  Ask owner (one-line question) before removing.
- `docs/firestore-rules-tests.md` + `LAUNCH-CHECKLIST.md`: update the test count
  (65 → 90) and the role table (role changes now Lead-Admin-only; Christin =
  Coordinator + Safeguard Lead + Lead Admin per D-1/D-2).

## WP-9 — Owner runbook (Chris's clicks; assistant prepares, owner executes)

Pre-launch, in order. Nothing here is code — it's Firebase console + terminal.

1. **Deploy the hardened rules** (after PR #12 merges). In the repo folder on your
   Mac: `npx firebase-tools login` (browser opens, pick the Firebase account),
   then `npx firebase-tools deploy --only firestore:rules --project safeguard-hub-71292`.
   (Alternative: paste `firestore.rules` into Firebase console → Firestore →
   Rules → Publish.)
2. **Upgrade to Blaze** (pay-as-you-go; ~$0 at this scale) and **enable MFA**
   (Authentication → Sign-in method → Advanced → Multi-factor). Set a billing
   budget alert first.
3. **Enroll MFA** on Chris's and Christin's accounts (each signs in → prompted to
   add a second factor once enabled).
4. **Grant Christin her access** (per D-1/D-2), the normal way, from a Lead-Admin
   account (Chris): open `admin-user.html` for Christin → set **Role = Coordinator**
   → in the Advanced panel tick **2FA verified**, then **Safeguard Lead** and
   **Lead Admin** → Save. (The rules require the 2FA box before the Lead flags, and
   block granting these to yourself — so Chris grants Christin, not herself.)
5. **Remove the bootstrap backdoor** once step 4 is confirmed working: delete
   `isBootstrapSafeguardLeadAdmin` (the `2JkW…` UID function, ~lines 54–58 of
   `firestore.rules`) and its use in `validSafeguardAccessUpdate` (the
   `|| isBootstrapSafeguardLeadAdmin(uid)` clause), retire
   `scripts/bootstrap-safeguard-lead-admin.mjs`, run `npm run test:rules`, then
   re-deploy the rules (step 1). This is WP-1's last open box (S-6).
6. **Set the help-form recipient** (WP-3.6b): in the deployed Apps Script, set
   `HELP_RECIPIENT` to the real monitored address, or "Have a question?" messages
   go nowhere.
7. **Clear the test data** for a clean launch (`LAUNCH-CHECKLIST.md` §1): delete the
   throwaway `submissions`, `abuseReports`, and test user accounts in the Firebase
   console (Firestore + Authentication).
8. **Set up backups**: schedule a periodic Firestore export and name who owns it
   (`LAUNCH-CHECKLIST.md`).
9. **Optional but recommended**: a paid pen-test / security sign-off focused on the
   rules and the sign-up/invite flow before real families use it.

> Order matters: 1 → 2 → 3 → 4 must happen before 5. Steps 6–9 can happen any time
> before launch. Only steps 1 and 5 touch the rules; everything else is console/UI.

## WP-10 — Re-enable email verification (blocked on owner decision)

Deferred because Firebase's default verification emails were landing in spam and
blocking sign-ups (that's why it's off — see git history). Do this as its own pass,
paired with the MFA rollout (WP-9 step 2–3):

1. Owner decision needed: reliable delivery. Options — a custom sender domain in
   Firebase Auth (SPF/DKIM), or a transactional email provider. Ask the owner in
   plain language; this is a deliverability choice, not code.
2. Once delivery is reliable, re-add `request.auth.token.email_verified == true` to
   `validSubmissionCreate` and `validAbuseReportCreate` in `firestore.rules`, and
   flip the test in `tests/firestore-access.test.mjs` (the "DOCUMENTED GAP" case)
   back to `assertFails`. Run `npm run test:rules`.
3. Consider limiting sign-up to invited email addresses, and add basic rate-limiting
   on abuse-report creation (needs the Cloud-Functions / Phase-B work — see S-9 and
   `docs/F-01-design.md`).
4. Restore `verify-email.html` (deleted in WP-4.3) as part of this pass.

---

## Suggested execution order (for the cheaper model)

Do them top-to-bottom; each is independently shippable and pushes to PR #12.

1. **WP-4.5** (friendly errors) and **WP-4.1/4.2/4.4** (copy fixes) — highest
   trust-per-effort, no rules risk.
2. **WP-3.2, WP-3.3, WP-5.4, WP-5.5** — small, self-contained correctness/display fixes.
3. **WP-3.1** (honest "save later" copy), **WP-4.3** (delete orphaned page),
   **WP-8** cleanup — low risk.
4. **WP-5.1, WP-5.2, WP-5.3, WP-5.6, WP-5.7** — UI quick wins (copy/CSS/config).
5. **WP-3.5** (activate.html + functions) and **WP-3.4** (reviewer re-stamp) — these
   touch `firestore.rules`/`functions`; run `npm run test:rules` and add tests.
6. **WP-6** (performance) then **WP-7** (admin scale) — larger, do last, keep diffs
   functional (no restyle; PR #11 owns styling).
7. **WP-3.6** (help endpoint) any time.

Leave for the owner: **WP-9** (all of it) and **WP-10** (needs the email decision).
Before opening each change for review, update the matching checkbox in
`LAUNCH-PLAN.md` so the owner sees live progress.
4. **Grant Christin** (per D-1/D-2):