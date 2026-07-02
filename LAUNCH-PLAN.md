# Safeguard Hub — Review & 30-Day Launch Plan

_Prepared 2026-07-02. Plain-language companion to `SECURITY_REVIEW.md` (the technical backlog) and `LAUNCH-CHECKLIST.md` (the go-live steps)._

This document turns "review the site, lock down the sensitive stuff, and polish the
UI before launch" into an ordered plan you can actually work through. It is written
for a non-coder. Nothing here has been deployed or changed on the live site — it is a
plan plus a list of findings from a full read-through of the code.

**How to read this:** Start with _The one thing only you can decide_. Then the plan is
four weekly phases. The full findings are in the appendix if you want the detail, but
you don't need to read them to approve the plan.

---

## The headline (in one paragraph)

The system is in good shape — it is a real, carefully-built app, not a rough
prototype. The single most important thing you were worried about **is already safe**:
a Coordinator **cannot** read suspected-abuse reports, and that is enforced by the
server (not just hidden on screen) and confirmed by automated tests. What still needs
work before real families' data goes in falls into three buckets: (1) **who can be
promoted** — right now any Coordinator can create more Coordinators, which quietly
widens who can see everyone's private info; (2) **"two-factor login" is not real yet** —
it's currently a checkbox someone ticks, not an actual second login step; and (3) a set
of **polish, clarity and speed** improvements for the people using it. None of these is
an emergency (everything in the system today is test data), but all should be closed in
the next 30 days.

---

## The one thing only you can decide (before I change permissions)

Everything else I can recommend and do. These two are genuinely your call, because they
define *who is allowed to see what*. Your answers change exactly what I build.

### Decision A — Should **Christin** be able to read suspected-abuse reports?

You said "nobody but Christin and myself should have access to the most private info."
As currently planned, **Christin would be a _Coordinator_, which does _not_ include
abuse-report access** — today only you (as _Safeguard Lead_) can read those. So there
are two possible meanings:

- **Option 1 — Chris only for abuse reports.** Christin runs the volunteer/admin side
  (sees roster info) but not suspected-abuse reports. This matches the "separation of
  duties" best practice your own checklist leans toward. It also means if you're ever
  unavailable, nobody can act on a report until you grant access.
- **Option 2 — Chris _and_ Christin for abuse reports.** Christin is also made a
  _Safeguard Lead_, so both of you can read and act on reports. Safer for coverage
  (a backup exists); slightly wider access to the most sensitive data.

_(Best practice for child protection is usually to have at least two trusted leads, so
one person isn't a single point of failure. But this is a policy call for you and your
church's guidance, not a technical one.)_

### Decision B — Should becoming a **Coordinator** require _you_?

Right now, **any** Coordinator can promote any volunteer to Coordinator. So if Christin
is a Coordinator, she could (accidentally or if her account were compromised) create a
third Coordinator, who would then see everyone's private info — without you being
involved. Your stated intent ("only Christin and myself can promote people to a
sensitive level") suggests you'd rather lock this down. Options:

- **Option 1 — Lock it (recommended).** Only the owner tier (you) can turn someone into
  a Coordinator or Safeguard Lead. Coordinators can still do all their day-to-day work,
  but can't expand the trusted circle on their own.
- **Option 2 — Leave it.** Any Coordinator can promote anyone. Simpler, but the circle
  of people who can see private info can grow without you.

> I will not change any permission rules until you've answered A and B.

---

## The 30-day plan

Each phase ends with something concrete. Nothing is deployed to the live Firebase
project without your explicit say-so — I prepare and test the changes; **you** click
"publish" on the rules and enable the paid features. That's a deliberate safety valve.

### Phase 1 — Week 1: Lock down sensitive access _(the heart of your request)_
Depends on Decisions A & B above.

- [ ] Stop any Coordinator from promoting people to Coordinator/Safeguard Lead (per Decision B).
- [ ] Close the "self-promotion" gaps: an admin can't quietly grant themselves the top
      role, and a Coordinator can't mark **their own** police check / approval as done.
- [ ] Make the "two-factor required" rule actually mean real two-factor — and apply it
      to the most powerful role too (today it's missing there).
- [ ] Remove the temporary "owner backdoor" left in the rules for first-time setup,
      once Christin's access is set the normal way.
- [ ] Update the automated permission tests to match, and get them passing again
      (they currently disagree with the live rules — see Finding S-7).
- [ ] **You:** review the plain-language summary of the rule changes and approve before deploy.

### Phase 2 — Week 2: Trust & correctness fixes
- [x] **Fix the "Undo" buttons that silently do nothing** (Finding B-6). _Done on this
      branch — client-only fix, no rules change._ Undoing a police-check clearance,
      interview, approval, ministry assignment (and training) now truly removes the data
      instead of showing a false success message.
- [ ] **Fix "Save & finish later" losing most of the application** (Finding B-7). Either
      actually save the in-progress answers, or change the button/message so it doesn't
      promise something it can't do.
- [ ] Fix the bug where marking a volunteer's police check as "following up" can lock
      that volunteer out of editing their own profile (Finding B-1).
- [ ] Re-enable email verification with reliable delivery, and require it before someone
      can file forms or abuse reports (closes the "any stranger can sign up and submit"
      gap — Finding S-5). Pair this with the two-factor rollout.
- [ ] Stop volunteers from being able to rewrite a reference's name/email after it's
      been marked "received" (Finding B-2), and tighten a few other data checks.
- [ ] Add a confirmation step before a coordinator changes someone's role or status
      (today one stray tap can demote a coordinator — Finding U-7).
- [ ] Never show raw, scary error text to volunteers; always offer a "try again"
      (Finding U-3).

### Phase 3 — Week 3: Polish, clarity & speed
- [ ] Remove internal document codes ("SG-FRM-002", etc.) from anything a volunteer or
      coordinator reads on screen; use plain names (Finding U-1).
- [ ] Fix the covenant that appears to start at "Section 2" (looks like text is missing — Finding U-4).
- [ ] Fix contradictory wording on sign-up and the reference-request email (Finding U-5).
- [ ] Make pages feel fast: show a proper "loading" instead of a blank screen, and stop
      loading two different font sets on every page (Findings U-8, U-12).
- [ ] Make the admin roster and lists work smoothly at 200+ people (Finding U-13).
- [ ] Decide the fate of the in-progress visual redesign (open draft PR #11) — finish it
      or set it aside — so the app stops "re-skinning itself" on load (Finding U-10).

### Phase 4 — Week 4: Pre-launch hardening & go-live
Mirrors `LAUNCH-CHECKLIST.md`; do once, right before launch.
- [ ] Turn on real two-factor login in Firebase (needs the pay-as-you-go "Blaze" plan;
      cost at your scale is effectively nil) and enrol you + Christin.
- [ ] Clear all test data (accounts, submissions, reports) for a clean start.
- [ ] Set up a periodic backup (Firestore export) and name who owns it.
- [ ] Publish the finalized security rules (your click).
- [ ] Optional but recommended: a paid penetration test / security sign-off focused on
      the rules and the sign-up/invite flow.
- [ ] Longer-term (not required for a small launch): the "who viewed which report" audit
      log, which needs the server-side (Cloud Functions) phase described in
      `docs/F-01-design.md`.

---

## Appendix — Full findings (plain language)

Severity: **Critical** = fix before launch and it touches sensitive access ·
**High** = fix before launch · **Medium** = should fix · **Low** = nice to fix.
"S-" = security, "B-" = bug, "U-" = user experience.

### What's already solid (verified, no action needed)
- A Coordinator **cannot** read suspected-abuse reports — enforced by the server and by tests.
- Only a Safeguard-Lead-Admin (you) can grant abuse-report access; a plain Coordinator can't.
- The temporary "break-glass" abuse-report access is admin-only, tied to one report,
  expires in 24 hours, and safely denies access if the expiry is missing.
- The sign-in redirect can't be hijacked to send users to an outside site.
- Admin screens properly neutralize user-entered text, so no obvious "injection" hole was found.
- The Firebase key visible in the code is a public identifier, not a secret — that's normal and fine.
- The old shared Google-Sheets password was fully removed.

### Security findings
- **S-1 (Critical) — Any Coordinator can promote anyone to Coordinator.** The rules let a
  Coordinator change any person's "role" with no limit on the value, so one Coordinator
  can create another (who then sees all roster info). _Fix in Phase 1 per Decision B._
- **S-2 (Critical) — "Two-factor required" isn't real, and the top role has no two-factor
  gate at all.** There is no actual second login step yet; `mfaEnrolled` is just a box an
  admin ticks. And the rule that checks it only applies when granting _Safeguard Lead_,
  not _Safeguard-Lead-Admin_ (the role that hands out abuse-report access). _Fix: enable
  real two-factor (Phase 4) and add the missing rule check (Phase 1)._
- **S-3 (High) — An admin can grant _themselves_ the top powers.** Nothing stops a
  Safeguard-Lead-Admin from ticking their own boxes to gain abuse-report access. _Fix in
  Phase 1: block self-promotion; require the change to come from someone else._
- **S-4 (High) — A Coordinator can approve their _own_ compliance.** Because coordinator
  edits aren't value-checked, a Coordinator could mark themselves police-check-cleared,
  approved, and active with no second person. _Fix in Phase 1._
- **S-5 (Medium) — Anyone on the internet can register and file reports.** Sign-up is
  public and email verification is off, so a stranger with a fake email can submit forms
  and abuse reports (they still can't _read_ anyone's data). Reports also can't be
  deleted from the app, so junk would be permanent. _Fix in Phase 2._
- **S-6 (Medium) — The temporary "setup backdoor" is still in the rules.** A specific
  owner account can re-grant itself top powers at any time, bypassing the normal process;
  the code even names that account (the repo is public). Limited risk, but it should be
  removed after setup. _Fix in Phase 1._
- **S-7 (High) — The automated permission tests no longer match the live rules.** When
  email verification was turned off, a test that says "an unverified user can't submit"
  was left behind, so the "65 tests all pass" claim in the checklist is now stale. _Fix
  in Phase 1 alongside the rule changes._
- **S-8 (Medium) — Two different permission designs coexist; one page is broken by it.**
  The live site decides access from profile fields; an older, unused server-function
  design uses a different method, and `activate.html` tries to set a status the rules
  forbid (so self-service activation quietly fails). The unused "Leader" role grants
  nothing. _Fix in Phase 2/3: pick one model, fix or label the dead paths._
- **S-9 (Low) — No "who viewed which report" log yet.** Fine for test data; needed before
  real reports. This is the server-side (Cloud Functions) phase in `docs/F-01-design.md`.
- **S-10 (Low) — The public "Have a question?" form can be spammed and is open to a
  spreadsheet-formula trick** when the message is logged to a Google Sheet. _Fix: prefix
  logged values, add light rate-limiting._
- **S-11 (Low) — The security "safety net" (CSP) is loose, and one long form saves
  sensitive answers to the device.** The ministry application autosaves date of birth,
  address, and criminal-history answers into the browser — a risk on shared computers.
  _Fix: turn off that autosave or clear it on sign-out._

### Bugs (things that are broken or will break)
- **B-1 (High) — "Following up" on a lapsed police check can lock a volunteer out of
  their own profile.** When a coordinator marks follow-up, the code writes a field the
  rules don't allow, so that volunteer's next attempt to edit anything (phone, covenant,
  references) silently fails. _Fix in Phase 2._
- **B-2 (High) — A volunteer can change a reference's name/email after it's marked
  "received."** So the "reference received" record could point at a different person than
  who actually vouched. _Fix in Phase 2._
- **B-3 (Medium) — A volunteer can set their covenant to never expire** (the expiry date
  is self-entered and unchecked). _Fix in Phase 2._
- **B-4 (Medium) — Coordinator edits accept any value/size** — a status could be set to
  nonsense text, or oversized data stored. _Fix in Phase 1/2 with the rule tightening._
- **B-5 (Low) — Small display bugs:** the personalized dashboard welcome is calculated
  then thrown away (everyone sees generic text); "Last synced just now" is hardcoded;
  wizard section labels are out of order (7 after 8); references counter shows "0/2" after
  a successful save. _Fix in Phase 3._
- **B-6 (High) — Coordinator "Undo/Remove" buttons silently do nothing.** Undoing a
  police-check clearance, interview, approval, or ministry assignment shows a green
  "removed" message but leaves the data in the database (a technical quirk: the "merge"
  save can add or change data but never delete it). So a clearance entered by mistake
  keeps showing as "Cleared." _Fix in Phase 2._
- **B-7 (High) — "Save & finish later" loses most of the application.** The auto-save only
  stores the basic profile (name, contact, serving prefs); the Safety Screening answers,
  References, Ministry-Experience, and Declarations live only in the browser and come back
  blank in a new session — with no warning, despite the "we'll pick up right here" promise.
  _Fix in Phase 2._
- **B-8 (Medium) — The invited-user activation page sets a status the rules reject.**
  `activate.html` tries to flip a user to "activated" (which isn't even a real status), a
  change the rules forbid, so it errors out. Dormant today (the live invite flow doesn't
  use it) but it fires the moment the emailed-invite/Cloud-Function path is switched on.
  Related to S-8. _Fix in Phase 2/3._
- **B-9 (Low) — Assorted:** the volunteer dashboard shows an **expired** police check as
  "Done"; a leftover "verify your email" page still waits forever for a verification that's
  never sent; account cleanup aborts if it hits a legacy abuse-report row; and the public
  "Have a question?" form still points at a placeholder email address, so those messages
  currently go nowhere (also a Phase 4 config item). _Fix in Phase 3/4._

### User-experience findings (grouped as the review delivered them)
**Quick wins (copy/CSS/config):**
- **U-1 (High) — Internal codes shown to users** ("SG-FRM-002" as a link label, admin
  filters reading "SG-FRM-001 (3)"). Use plain names.
- **U-2 (High) — Low-contrast text** (grey text and blue links fall below the
  readability standard) — hard for older volunteers. One CSS file fixes it site-wide.
- **U-3 (High) — Raw error text shown to volunteers**, and load failures dead-end with no
  "try again." Route through the friendly-message helper you already have.
- **U-4 (High) — The Worker's Covenant starts at "Section 2"** — looks like content is missing.
- **U-5 (High) — Contradictory copy**: the sign-up button says "Send verification email"
  but none is sent; the reference email tells the referee _not_ to reply.
- **U-6 (Medium) — "Step X of 4" labels** don't match the real setup flow.
- **U-7 (High) — Role/status change instantly on tap** in the admin roster — add a
  confirm/undo to prevent accidental demotions.
- **U-8 (Medium) — Two font systems load on every page**; drop the unused set and a
  fragile font-integrity setting.
- **U-9 (Medium) — The personalized dashboard welcome is discarded** (see B-5).
- **U-10 (Medium) — Pages "re-skin" themselves on load** (old colors flash, then the new
  look snaps in). Tie into the redesign decision (PR #11).
- **U-11 (Low) — Disabled "Continue with Microsoft" buttons** look unfinished; hide until ready.

**Bigger projects:**
- **U-12 (High) — Blank screen until Firebase answers.** Static pages (policies,
  covenant text, how-to steps) hide until sign-in resolves — 1–3 seconds of blank screen
  on a phone. Show the static content immediately; only gate the personal bits.
- **U-13 (High) — Admin lists don't scale.** The roster loads everyone at once with no
  search/paging and re-reads all of it on every edit; the submissions list silently caps
  at 500; the screening table cuts off its "Open" button on phones.
- **U-14 (Medium) — The same profile is read 3–4 times per page load** — slows first
  paint. Load it once and share it.
- **U-15 (Medium) — Two different "set up your profile" screens** (the new-volunteer
  wizard vs. the "edit profile" form) can drift apart; and admins only get a hover-only
  menu that barely works on touch. Consolidate.

---

## Open policy questions (from `docs/F-01-design.md`, still worth deciding before launch)
These aren't code issues — they're decisions your church should make:
who is the backup Safeguard Lead; can reports be exported and by whom; must every report
view record a reason; how long are reports kept; who can close a report; is there a
"break-glass" emergency policy. See the full list in `docs/F-01-design.md`.
