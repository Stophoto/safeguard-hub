# Admin Dashboard — Build Hand-off

Status: ready to build
Target branch: new branch off `main` (do not reuse the planning branch)
Related: replaces the placeholder `admin-tasks.html`

This document is a complete, self-contained brief for a fresh Claude Code session.
It describes **what to build and why** — not line-by-line code. Read it top to
bottom once before starting. Plain-language rationale is included so the voice of
the result stays warm and lay-person friendly, matching the rest of the Hub.

---

## 1. Purpose & context

The Safeguard Hub is a child-protection system for Bethany Chapel's children's and
youth ministry. One person — the **Safeguard Coordinator** — keeps it running.
Today, clicking **Admin** drops them into **People** (a roster table). There is no
front door, and nothing tells them what each section is for or what needs their
attention right now.

We are building an **Admin Dashboard** that becomes the coordinator's home base.
Clicking **Admin** lands here. It answers three questions at a glance:

1. **What needs me right now?** (a live to-do list the system builds from real data)
2. **What am I due to do?** (the recurring rhythm, with a memory of when each was last done)
3. **Where do I go for the detail?** (clearly labelled links to the five sections)

The guiding idea: *less a checklist to obey, more a colleague who opens the day with
"here's what I noticed, and here's what you're due for."*

---

## 2. Decisions already locked in

These were decided with the project owner. Do not re-litigate them.

- **The dashboard is the new Admin home.** Create `admin-dashboard.html`. Every
  "Admin" entry point routes here.
- **"Tasks" folds into the dashboard.** The old `admin-tasks.html` is retired and
  its recurring-rhythm content lives on the dashboard. Remove the "Tasks" nav item
  everywhere.
- **Build the check-off memory now.** The rhythm section must remember when each
  recurring task was last done and flag overdue ones. This needs one small new
  Firestore collection plus a security rule (Section 5).
- **Abuse reports stay separate and Safeguard-Lead-only.** The dashboard must not
  show abuse-report counts to an ordinary coordinator (Section 4.7).

---

## 3. Information architecture & file changes

### Add
- `admin-dashboard.html` — the new home (built from the shared admin page shell:
  copy the `:root` design tokens, header, nav, card/stat/badge CSS from any existing
  admin page such as `admin.html`).
- `sg-rhythm.js` — small module for the recurring-task definitions + read/write of
  the check-off memory (Section 5).
- Optional: `sg-admin-dashboard.js` for the page's compute logic, or inline it in the
  page like the other admin pages do. Match whatever keeps it consistent with siblings.

### Remove
- `admin-tasks.html` — delete after its content is folded in.

### Change — nav rewiring (the "Tasks → Dashboard" swap)
The admin pages share a header nav block. Update it on **every** admin page
(`admin.html`, `admin-screening.html`, `admin-submissions.html`,
`admin-room-kit.html`, and the new `admin-dashboard.html`):

| Before | After |
| --- | --- |
| People · Screening · Submissions · **Tasks** · Room Kit · Hub | **Dashboard** · People · Screening · Submissions · Room Kit · Hub |

- `Dashboard` → `admin-dashboard.html`; mark it `.active` on the dashboard page.
- Drop the `Tasks` link entirely.

Other entry points to repoint to `admin-dashboard.html`:

| File | What to change |
| --- | --- |
| `dashboard.html` (volunteer home) | `#adminLink` href `admin.html` → `admin-dashboard.html` |
| `sg-nav.js` | In `ADMIN_LINKS`, remove `{ Tasks, admin-tasks.html }` and add `{ Dashboard, admin-dashboard.html }` as the first item. Point the coordinator "Admin" item itself at `admin-dashboard.html` so a plain click lands on the dashboard. |
| `admin-user.html` | "← Admin" back-link + breadcrumb → `admin-dashboard.html` |
| `invite.html` | "← Admin", "Cancel", "Back to Admin" → `admin-dashboard.html` |
| `admin-submissions.html`, `admin-submission.html` | breadcrumb "Admin ›" → `admin-dashboard.html` |

Leave `SG-SOP-001.html`'s links to `admin.html` (Admin · People) as-is — those point
to the People section deliberately, for recording interview/compliance steps.

---

## 4. The dashboard, section by section

Render top to bottom. All numbers/lists are computed from one load of `listUsers()`
and `listSubmissions()` plus the rhythm memory. Use the existing coordinator auth
gate (copy from `admin.html`: `onUserChange` → `getOrCreateProfile` → require
`role === "coordinator"`, else show the standard "Coordinator only" panel).

### 4.1 Intro blurb (orientation)
Short, warm, purpose-first. Suggested copy:

> **Admin home · your command center**
> Everything that needs your attention to keep Bethany Chapel's ministry safe and
> running is gathered here. The five sections below hold the full detail.

### 4.2 Health row (four glance numbers)
Reuse `summarizeUsers(users)` → `{ active, inProcess, leaders, renewalSoon }`.

| Tile | Value | Source |
| --- | --- | --- |
| Active | `active` | summarizeUsers |
| Onboarding | `inProcess` | summarizeUsers |
| Leaders & Coordinators | `leaders` | summarizeUsers |
| Compliance | "✓ All checks clear" or "N need attention" | Section 4.3 Group A count + 60-day renewals; amber/red when > 0 |

### 4.3 "Needs you now" — the live to-do list
The heart of the page. Each line links straight to the page that resolves it. Order
by urgency (Group A first). Hide any line whose count is zero. If **all** are zero,
show the positive empty state (4.6).

| # | Item (copy) | Shows when | Links to | Tone |
| --- | --- | --- | --- | --- |
| A | "N serving volunteer(s) with a lapsed police check" | `status === "active"` AND ( no `policeCheck.clearedAt` OR `policeCheck.expiresOn` is in the past ) | that volunteer's `admin-user.html?uid=` (or People) | **red** |
| B1 | "N application(s) waiting for an interview" | `application?.submittedAt` present AND `screeningState(u) === "not-started"` AND status ≠ inactive | `admin-screening.html` (Not started) | amber |
| B2 | "N waiting on an approval decision" | `screeningState(u) === "interview-done"` | `admin-screening.html` (Interview done) | amber |
| B3 | "N approved, waiting for a ministry assignment" | `screeningState(u) === "approved"` | `admin-screening.html` (Approved) | amber |
| B4 | "N ready to activate" | `isReadyForActivation(u)` | `admin.html` (activation queue) | normal/green |
| C1 | "N reference(s) still outstanding" | `references.items.length > 0` AND any item has no `receivedAt` | `admin-user.html?uid=` | normal |
| C2 | "N police check(s) submitted, awaiting your clearance" | `policeCheck.submittedAt` AND no `policeCheck.clearedAt` | `admin-user.html?uid=` | normal |
| C3 | "N police check(s) expiring within 60 days" | `policeCheck.expiresOn` (or `renewalDueOn`) within next 60 days and still in the future | list names → `admin.html` | amber |
| D1 | "N incident report(s) to review" | submissions `formCode === "SG-FRM-006"` AND `status === "open"` | `admin-submissions.html` (SG-FRM-006) | amber |
| D2 | "N new application(s) to review" | submissions `formCode === "SG-FRM-001"` AND `status === "open"` | `admin-submissions.html` (SG-FRM-001) | normal |
| D3 | "N child registration(s) to review" | submissions `formCode === "SG-FRM-005"` AND `status === "open"` | `admin-submissions.html` (SG-FRM-005) | normal |

Notes:
- Group A is the single most important safeguarding signal. Make it visually loud
  (red) and always first. It is new — nothing computes it today.
- "Today" comparisons: parse `expiresOn` / `renewalDueOn` (YYYY-MM-DD strings) with
  `new Date(...)`; compare to `new Date()`.

### 4.4 "Your rhythm" — recurring tasks with memory
A compact list grouped by cadence. Each row shows its label, "last done" date (from
the rhythm memory), a due/overdue indicator, and a **Mark done** button that stamps
the memory (Section 5). Each links to its governing document.

Definitions live in `sg-rhythm.js` as `RHYTHM_TASKS` (see Section 5 for the shape):

**Weekly** (intervalDays 7)
- Two-adult rule held in every room — `SG-POL-002.html`
- Rooms within ratio / capacity — `SG-SOP-003.html`
- Sign-in & pickup tags running — `SG-SOP-005.html`

**Monthly** (intervalDays 30)
- Unannounced walkthrough of all ministry spaces — `SG-T-103.html`
- Tidy the roster — pause anyone who has stopped serving — `admin.html`

**Quarterly** (intervalDays 90)
- Training & clearance audit (everyone serving is fully trained and cleared) — `SG-G-001.html`
- Refresh children's emergency / medical info — `SG-FRM-005.html`

**Yearly** (intervalDays 365)
- Full compliance audit — `SG-G-001.html`
- Police-check renewal cycle (3-year checks) — `SG-FRM-003.html`
- Policy review — keep all policies current — `SG-G-001.html`
- Report to the Board of Elders — `SG-G-001.html`

Due logic: `overdue` when `now - lastDoneAt > intervalDays`; `due-soon` within the
last ~20% of the interval; otherwise `ok`. Never-done tasks read as "due now".

> Important currency note: the Worker's Covenant is **sign-once** (no annual renewal)
> and training has no expiry. The only recurring *renewal* is the **3-year police
> check**. Do not reintroduce annual covenant-renewal language — the old page had it
> and it is wrong now.

### 4.5 Section cards (the five rooms)
A grid of cards, each with a three-word identity and a one-line purpose so a new
coordinator never has to guess. Suggested copy:

- **People — the directory.** Everyone who's signed up: role, status, and compliance.
  Invite volunteers, promote leaders, activate the ready, export the roster.
- **Screening — the funnel.** Who's waiting on an interview, a decision, or a ministry
  assignment — and a one-click way to move them forward.
- **Submissions — the inbox.** Every form filed in the Hub: applications, incident
  reports, references, child registrations, training records. Review and close them.
- **Room Kit — the print shop.** Posters and cards for each classroom — ratios, escort
  rules, sign-in/out, emergency steps. Print before the ministry year starts.

(People and Screening overlap and open the same volunteer record; the "directory vs
funnel" wording is the fix for that long-standing confusion. Keep them separate.)

### 4.6 Empty / positive states
Reassurance is a feature for this audience.
- Needs-you-now empty: "You're all caught up — nothing needs you right now."
- A rhythm task done recently: show "last: 3 days ago ✓" in calm green.

### 4.7 Safeguard-Lead gating (abuse reports)
Only show an abuse-reports entry to users with `profile.safeguard_lead === true`,
reusing `countAbuseReports()` from `sg-abuse-reports.js` (this is how
`admin-submissions.html` already does it). An ordinary coordinator must see nothing
about abuse reports on the dashboard.

---

## 5. Data model — the rhythm memory

### Collection
One document holds the whole rhythm state (cheapest, simplest):

`/adminRhythm/current`

```js
{
  tasks: {
    "weekly-two-adult":  { lastDoneAt: "2026-06-15T...", lastDoneBy: "<uid>" },
    "monthly-walkthrough": { lastDoneAt: "2026-05-29T...", lastDoneBy: "<uid>" },
    // ... keyed by RHYTHM_TASKS[].key
  },
  updatedAt: <serverTimestamp>
}
```

### Firestore rule
Add **before** the catch-all `match /{document=**}` block in `firestore.rules`,
mirroring the existing `invites` / `config` pattern:

```
match /adminRhythm/{docId} {
  allow read, write: if isCoordinator();
}
```

> Deploy note: per `README.md` / `SECURITY_REVIEW.md`, do **not** publish
> `firestore.rules` without the project owner's explicit approval. Make the edit,
> call it out in the PR, and leave deployment to them.

### `sg-rhythm.js` API (suggested)
```js
export const RHYTHM_TASKS = [
  { key: "weekly-two-adult", label: "Two-adult rule held in every room",
    cadence: "weekly", intervalDays: 7, href: "SG-POL-002.html" },
  // ... all tasks from Section 4.4
];

export async function loadRhythm();              // → { [key]: { lastDoneAt, lastDoneBy } }
export async function markRhythmDone(key);        // merge-write lastDoneAt: now, lastDoneBy: uid
export function rhythmStatus(task, state);        // → { lastDoneAt, dueState: "ok"|"due-soon"|"overdue" }
```
Use the same Firestore SDK import style and `serverTimestamp()` already used in
`sg-admin.js`.

---

## 6. Reuse map (don't reinvent these)

| Need | Already exists |
| --- | --- |
| All users | `listUsers()` — `sg-admin.js` |
| Health counts | `summarizeUsers()` — `sg-admin.js` |
| Screening stage of a profile | `screeningState()` / `screeningLabel()` — `sg-admin.js` |
| "Ready to activate?" | `isReadyForActivation()` — `sg-profile.js` |
| Onboarding step detail | `computeOnboarding()`, `covenantStatus()`, `trainingModulesFor()` — `sg-profile.js` |
| Date formatting | `formatDate()` — `sg-profile.js` |
| Submissions + form schemas | `listSubmissions()`, `FORM_SCHEMAS`, `statusBadgeClass()` — `sg-submissions.js` |
| Abuse-report count (Lead-only) | `countAbuseReports()` — `sg-abuse-reports.js` |
| Auth gate + user chip | `onUserChange` (`sg-auth.js`), `mountUserChip` (`sg-user-chip.js`) |
| Mobile nav collapse | include `sg-nav.js` + `sg-admin-nav.js` like every admin page |
| Styling | copy the shared `:root` tokens + header/card/stat/badge CSS from `admin.html` |

---

## 7. Section-page intro blurbs (small, separate win)
So context travels with the coordinator, add a one-line purpose under the `<h1>` of
each section page (several already have a `lede` — make them purpose-first and
consistent):

- **People:** "Everyone who's signed up — their role, status, and where they are with screening and compliance."
- **Screening:** "The approval pipeline. Each volunteer's stage from interview to ministry assignment — filter by stage to see who needs the next nudge."
- **Submissions:** "Every form filed in the Hub, in one place to review and close out."
- **Room Kit:** "Printable posters and cards for each classroom. Print the full kit before the ministry year, or when a room needs a fresh set."

---

## 8. Out of scope / future (note, don't build)
- **Off-site & transportation tracking.** Driver applications (`SG-FRM-010`), trip
  plans (`SG-FRM-011`), and event permissions (`SG-FRM-009`) exist as forms but are
  not tracked anywhere in admin. A future "Trips" surface could manage them. Park it.
- **Server-side read audit logging** and idle-timeout hardening — see
  `SECURITY_REVIEW.md`. Unchanged by this work.

---

## 9. Build checklist (suggested order)
1. Scaffold `admin-dashboard.html` from the shared admin shell + coordinator gate.
2. Wire the nav swap (Tasks → Dashboard) across all admin pages + `sg-nav.js` +
   `dashboard.html` + back-links/breadcrumbs (Section 3).
3. Build the health row from `summarizeUsers()` + the Group A compliance check.
4. Build "Needs you now" (Section 4.3) from one users+submissions load.
5. Add `sg-rhythm.js` + the `adminRhythm` rule; build "Your rhythm" with Mark-done.
6. Add the five section cards + the dashboard intro blurb.
7. Add the four section-page intro blurbs (Section 7).
8. Delete `admin-tasks.html`.
9. Manual pass on mobile width (nav collapses, cards stack).

## 10. Acceptance criteria (done when…)
- Clicking **Admin** anywhere lands on `admin-dashboard.html`; no "Tasks" link remains.
- A non-coordinator sees the "Coordinator only" panel.
- "Needs you now" reflects real data and each line deep-links to the right section.
- An active volunteer with an expired/missing police check raises the **red** Group A alert.
- Each rhythm task shows a real "last done" and an overdue flag; **Mark done** persists
  across reloads (writes `/adminRhythm/current`).
- Abuse-report info appears only for `safeguard_lead` users.
- The page matches the existing visual language and reads in plain, warm language.
- No annual covenant-renewal language anywhere (covenant is sign-once; police checks
  are the only 3-year renewal).

## 11. Tone & design
Match the Hub's existing voice — warm, plain, lay-person friendly (see the volunteer
`dashboard.html` welcome copy as the model). Reuse the established palette and
components; this should feel like it was always part of the Hub, not bolted on.
