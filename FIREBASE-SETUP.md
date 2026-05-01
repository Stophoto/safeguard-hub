# Safeguard Hub — Firebase Setup

Plain-English notes on how this site's authentication is wired up, what's
configured in Firebase, and what you need to do when deploying.

Written for a non-developer owner. If you're reading this in the future
and something is unclear, start at the top and work down.

---

## What this does

Users sign in with email and password. Firebase (a Google service) stores
the accounts and handles verification emails, password resets, and sessions.
Data (user profiles, submitted forms, training records) lives in Firestore,
Firebase's database.

The static HTML files deployed to GitHub Pages talk to Firebase directly
from the user's browser using JavaScript. No server code.

---

## Firebase project

- **Project name:** Safeguard-Hub
- **Project ID:** `safeguard-hub-71292`
- **Console:** https://console.firebase.google.com/project/safeguard-hub-71292
- **Plan:** Spark (free tier) — fine for hundreds of users

The config values are in `sg-firebase.js` at the root of the repo. These
are public identifiers — not secrets. Real security is enforced by
Firestore Security Rules (we add these in Phase 2).

---

## What's been set up

### ✅ Phase 0 — done
- [x] Firebase project created
- [x] Firestore database created (production mode, default location)
- [x] Email/Password sign-in enabled
- [x] Web app registered, config pasted into `sg-firebase.js`
- [ ] Authorized domains — **action required below**

### ⚠️ Authorize the live site's domain

Firebase blocks logins from domains it doesn't know about. Localhost is
allowed by default, but your GitHub Pages URL needs to be added manually.

1. Open https://console.firebase.google.com/project/safeguard-hub-71292/authentication/settings
2. Scroll to **Authorized domains**
3. Click **Add domain**
4. Enter `stophoto.github.io` (just the domain, no path, no `https://`)
5. Click **Add**

That's it. You only need to do this once.

### ✍️ Customize verification & reset emails (optional, recommended)

By default, Firebase's emails come from `noreply@safeguard-hub-71292.firebaseapp.com`
and say generic things. You can customize them:

1. https://console.firebase.google.com/project/safeguard-hub-71292/authentication/emails
2. Click **Email address verification** → pencil icon (edit)
3. **Sender name:** change to `Bethany Chapel Safeguard Hub`
4. **Reply-to address:** change to whatever Coordinator email you want replies to go to (e.g. the Coordinator's personal email for now)
5. Optionally edit the subject line and body to match your tone
6. Save. Repeat for **Password reset** template.

---

## Files in this repo that talk to Firebase

| File | Purpose |
|---|---|
| `sg-firebase.js` | One-time Firebase initialization. Exports `auth` and `db` for other files to use. **This is where your project's config values live.** |
| `sg-auth.js` | Helper functions — sign in, sign up, sign out, send password reset, etc. Other pages import from here instead of calling Firebase directly. |
| `sign-in.html` | Login page |
| `sign-up.html` | Create account page |
| `verify-email.html` | "Check your inbox" page that appears right after sign-up. Polls Firebase every 4 seconds to detect when the user clicks the verification link in their email. |
| `forgot-password.html` | Sends a password-reset email |

---

## How to test (Phase 1)

Once the files are uploaded to GitHub and the authorized domain is added:

1. Go to `https://stophoto.github.io/safeguard-hub/sign-up.html`
2. Create an account with a **real email you control** (so you can click the link)
3. You'll be redirected to `verify-email.html`
4. Check your inbox for a Firebase verification email (may land in spam)
5. Click the link → a Firebase page confirms verification
6. Go back to your `verify-email.html` tab — within 4 seconds it should update to "You're in" and let you continue
7. Try `sign-in.html` → sign out by visiting `verify-email.html` and clicking "Wrong email?" — that signs you out for testing purposes. *(A proper sign-out button lives in the nav bar and gets wired up in Phase 4.)*
8. Try `forgot-password.html` with the same email → you'll get a reset email

You can see every account you've created here:
https://console.firebase.google.com/project/safeguard-hub-71292/authentication/users

You can delete test accounts from that page so they don't clutter things up.

---

## Deploying to GitHub Pages

Since you upload files through the GitHub web UI (not Terminal):

1. On github.com, go to your repo `Stophoto/safeguard-hub`
2. Click the branch dropdown (where it says "main")
3. Type `auth-feature` and click "Create branch: auth-feature from main"
4. You're now on the `auth-feature` branch. Click **Add file → Upload files**
5. Upload these 7 new files from this folder:
   - `sg-firebase.js`
   - `sg-auth.js`
   - `sign-in.html`
   - `sign-up.html`
   - `verify-email.html`
   - `forgot-password.html`
   - `FIREBASE-SETUP.md` (this file)
6. Commit directly to the `auth-feature` branch with a message like: `Phase 1: add Firebase auth pages`

### Testing the branch before merging

GitHub Pages by default only serves the `main` branch. To test `auth-feature`
live, you have two options:

- **Option A (easy):** After Phase 4 is done and you've tested locally, merge
  `auth-feature` into `main` via a Pull Request. GitHub Pages republishes automatically.
- **Option B (fancier):** In repo Settings → Pages → set the source to
  `auth-feature` temporarily while testing, then switch back to `main` after.

For Phase 1 testing, the preview panel in Claude Code shows you the pages
locally — that's enough to verify the UI and flows. Wait to upload to
GitHub until we finish Phase 2 so you aren't deploying a half-built system.

---

## What's coming next

### Phase 2 — Profile + volunteer dashboard  ✅ built
- New pages: `profile-setup.html`, `dashboard.html`
- Firestore starts holding `users/{uid}` documents with personal info,
  emergency contact, ministry preferences (age groups, service times)
- First Firestore Security Rules added (see `firestore.rules`)
- See "Phase 2 deploy" section below for upload + rules publish steps

### Phase 3 — Admin / coordinator  ✅ built
- New pages: `admin.html`, `invite.html`
- New helpers: `sg-admin.js`
- Updated: `firestore.rules`, `dashboard.html`
- See "Phase 3 deploy" section below

### Phase 3 — Admin / coordinator (original description)
- New pages: `admin.html`, `invite.html`
- Promote your account (`prefontainech@gmail.com`) to Coordinator by
  editing its Firestore document (one-click — instructions at that time)

### Phase 4 — Gate existing pages
- `index.html` redirects to sign-in if not logged in
- Nav shows user pill + sign-out button

### Phase 5 — Retrofit existing forms
- FRM-001, 006, 007, 012 auto-fill from profile

### Later (not scheduled yet)
- Training progress tracking
- Sheets export alongside Firestore

---

---

## Phase 2 deploy — do these in order

### Step 1 — Upload the new files to GitHub

On github.com, make sure you're on the `auth-feature` branch of the
`safeguard-hub` repo.

1. Click **Add file → Upload files**.
2. From your Mac's `safeguard-hub-main` folder, upload these 4 new files:
   - `sg-profile.js`
   - `profile-setup.html`
   - `dashboard.html`
   - `firestore.rules`
3. Also re-upload these 3 files that I edited (same names, new content — GitHub will offer to replace):
   - `sign-in.html`
   - `verify-email.html`
   - `FIREBASE-SETUP.md`
4. Commit message: `Phase 2: profile setup, dashboard, Firestore rules`
5. Commit directly to `auth-feature`.

Wait for the Actions tab to show a green checkmark on the latest
`pages build and deployment` run before testing.

### Step 2 — Publish the Firestore Security Rules

Uploading `firestore.rules` to GitHub does NOT apply it to Firestore.
Firestore rules live inside Firebase, not your site. You have to paste
them in once.

1. Open `firestore.rules` on your Mac (or on GitHub) and **copy its
   entire contents**.
2. Go to https://console.firebase.google.com/project/safeguard-hub-71292/firestore/rules
3. You'll see a code editor with the default rules. **Select all** and
   **paste** the contents of `firestore.rules` in, replacing what's there.
4. Click the blue **Publish** button at the top right.
5. A confirmation dialog appears — click **Publish**.
6. Within a few seconds, your rules are live. 🔒

### Step 3 — Test the full Phase 2 flow

Use a fresh incognito window.

**New account path:**
1. Delete your existing test account from
   https://console.firebase.google.com/project/safeguard-hub-71292/authentication/users
   (hover row → ⋮ → Delete account).
2. Go to https://stophoto.github.io/safeguard-hub/sign-up.html and sign up
   again with `prefontainech@gmail.com`.
3. Verify the email (check junk).
4. You should land on `profile-setup.html` — fill it out.
5. Click **Continue →** → you land on `dashboard.html`.
6. You should see "Welcome back, [your first name]" with a progress bar.

**Existing-account path:**
1. Sign out (button on the dashboard top-right).
2. Sign back in at `sign-in.html`.
3. You should land back on `dashboard.html` directly — not the profile form again.

### Step 4 — Confirm data was saved

1. Go to https://console.firebase.google.com/project/safeguard-hub-71292/firestore/data
2. You should see a `users` collection.
3. Click into it. You'll see one document — the ID is your Firebase user
   ID (a long string). Click into that document.
4. You should see all the fields from the form: `firstName`, `lastName`,
   `dob`, `address`, `emergencyContact`, `ageGroups`, `serviceTimes`, etc.
5. Note the `role: "volunteer"` field — this is how Phase 3's admin
   panel will know you're not a Coordinator yet. We'll fix that in the
   next phase.

---

---

## Phase 3 deploy — do these in order

### Step 1 — Upload the new & edited files to GitHub

On github.com, **first make sure the branch dropdown says `auth-feature`** (this is the step that tripped you up before).

Upload these 5 files:

- `sg-admin.js` (new)
- `admin.html` (new)
- `invite.html` (new)
- `firestore.rules` (replaces the Phase 2 version)
- `dashboard.html` (replaces — now shows an Admin link for coordinators)
- `FIREBASE-SETUP.md` (this file, updated)

Commit message:
```
Phase 3: coordinator admin panel + invite flow
```

Commit directly to `auth-feature`. Wait for the green checkmark on the Actions tab.

### Step 2 — Publish the updated Firestore Security Rules

The rules file changed (coordinators can now read everyone + manage the invites collection). Republish:

1. Open `firestore.rules` on your Mac and copy its entire contents (Cmd+A, Cmd+C).
2. Go to https://console.firebase.google.com/project/safeguard-hub-71292/firestore/rules
3. Click inside the rules editor.
4. Select all existing rules (Cmd+A), delete them (Delete key).
5. Paste (Cmd+V).
6. Click the blue **Publish** button.

If you skip this step, the admin panel will show "Couldn't load admin panel" because the old rules don't allow coordinators to read other users.

### Step 3 — Promote your own account to Coordinator (one-time)

Your account is currently `role: "volunteer"`. To become the first Coordinator, edit your user document directly in the Firebase console (this bypasses the rules since you're using admin tools).

1. Open: https://console.firebase.google.com/project/safeguard-hub-71292/firestore/data
2. In the left column, click the **users** collection.
3. A middle column shows one document — the ID is your Firebase user ID (a long random string). Click that document.
4. In the right pane, you'll see all your profile fields. Find the row that says **`role`** with value **`"volunteer"`**.
5. Hover over that row. A small **pencil icon ✏️** appears on the far right. Click it.
6. An "Edit field" dialog opens with:
   - Field name: `role` (leave it)
   - Type: `string` (leave it)
   - Value: `volunteer` — change this to **`coordinator`** (exact spelling, lowercase, no quotes needed in the input).
7. Click **Update**.
8. The value in the document now shows `"coordinator"`.

### Step 4 — Test Phase 3

Back at https://stophoto.github.io/safeguard-hub/dashboard.html:

1. **Hard refresh** (Cmd+Shift+R) — needed so your browser re-reads your updated profile.
2. Your pill should now say **`Chris · Coordinator`**.
3. An **Admin** link should appear in the top nav. Click it.
4. You land on `admin.html` with a People & Compliance table showing your own account listed.
5. Stats should say: Active: 0, In-process: 1, Leaders & Coordinators: 1.

### Step 5 — Test the invite flow

1. From the Admin page, click **+ Send invite**.
2. Fill in someone's email (use your own second email for testing).
3. Click **Save & open email** — your default email app should pop up with a pre-written invitation.
4. You can actually send it to yourself and click the sign-up link — the invitee then goes through the normal sign-up flow.
5. Back in Admin → refresh — the new invitee appears in the People list (after they've signed up and made a profile).

### Step 6 — Test role management

1. In the Admin panel, find your own row. Notice the Role dropdown is **disabled** (you can't demote yourself — safety feature).
2. Invite someone (or use an existing non-coordinator account if you have one).
3. In their row, use the Role dropdown to promote them to **Leader**.
4. Within a second, the change saves and the row refreshes.
5. Test demotion too.

---

## If something goes wrong

**"Access denied · Coordinator only" on admin.html:**
- Your profile's role isn't `"coordinator"`. Re-check Step 3.
- If the role field says `coordinator` but you still see access denied, hard refresh the page (Cmd+Shift+R) — your browser has cached old auth state.

**"Couldn't load admin panel" or similar permission errors:**
- The updated Firestore rules aren't published. Redo Step 2.

**Admin link doesn't appear in the dashboard nav:**
- Your profile role isn't coordinator (see above), OR
- The browser is showing the old dashboard.html. Hard refresh.

---

---

## Phase 3.5 deploy — user detail + CSV export

A small expansion to the admin panel. No Firestore rules change — rules from Phase 3 already allow coordinators to read/write any profile.

### Step 1 — Upload to the `auth-feature` branch

**First, switch the branch dropdown to `auth-feature`** on github.com/Stophoto/safeguard-hub.

Upload these 4 files:

- `admin-user.html` (new — full profile view for coordinators)
- `admin.html` (replaces — adds "Open →" column and Export CSV button)
- `sg-admin.js` (replaces — adds loadUser, updateUserProfile, usersToCsv, downloadCsv)
- `sg-profile.js` (replaces — now captures email on new profiles and backfills existing)

Commit message:
```
Phase 3.5: user detail page + CSV export
```

Commit to `auth-feature`. Wait for green checkmark in Actions.

### Step 2 — Test

1. Sign into your Coordinator account. Hard refresh (Cmd+Shift+R).
2. Go to the Admin page.
3. Your own row should now show your email address under your name (the backfill kicked in the first time you loaded the admin page — it saved your email onto your profile).
4. Click **Open →** on your own row. You land on `admin-user.html?uid=...`. You see every field of your profile. Your role/status dropdowns are locked (safety).
5. Back to Admin. Click **Export CSV**. A file like `safeguard-people-2026-04-17.csv` downloads.
6. Open the CSV in Excel, Numbers, or Google Sheets. You should see a row per person with every profile field as a column.

### What to know about CSV export

- **Downloads every person's full profile**, including emails, addresses, emergency contacts, DOBs — anything stored in Firestore. Treat this file like sensitive data.
- **It's a snapshot**, not a live link. Running it again gives you a fresh copy.
- **Works offline** — once downloaded, you can delete it later from the Downloads folder.

---

---

## Phase 4 deploy — unify navigation + gate the hub

This phase connects the legacy hub to Firebase. Anonymous visitors land on sign-in. Signed-in users see a unified navigation on every page with a user pill, a Dashboard link, and a Sign-out button. The old shared-password prompt goes away because the system fetches that password from a Firestore config doc.

### Step 1 — Upload to `auth-feature`

**Switch the GitHub branch dropdown to `auth-feature`** first. Then upload these 3 files:

- `index.html` (replaces — now has the Firebase auth gate)
- `sg-nav.js` (replaces — now injects user pill + Dashboard link + Sign-out)
- `firestore.rules` (replaces — allows signed-in users to read `/config/hub`)

Commit message:
```
Phase 4: Firebase-gate the hub + unified nav
```

Commit to `auth-feature`. Wait for green checkmark in Actions.

### Step 2 — Republish the Firestore rules

The rules changed. `/config` is now Coordinator-only because it may contain operational secrets or sensitive switches.

1. Copy `firestore.rules` contents on your Mac (Cmd+A, Cmd+C in TextEdit).
2. https://console.firebase.google.com/project/safeguard-hub-71292/firestore/rules
3. Click inside the editor, Cmd+A, Delete, Cmd+V.
4. Click **Publish**.

If you skip this step, the app will still have the older, weaker client-side access rules.

### Step 3 — Do not create a client-readable Sheets password

The old `/config/hub.sheetsPassword` bootstrap has been retired for security. Do not create or expose a shared Apps Script password to client browsers. Hub submissions should write to Firestore only until a server-side Sheets mirror is added.

### Step 4 — Test the gated hub

1. Sign out first if you're signed in anywhere.
2. Open a new incognito window. Go to https://stophoto.github.io/safeguard-hub/index.html
3. Expected: you get bounced to `sign-in.html`.
4. Sign in with your Coordinator account.
5. After a brief "Checking sign-in…" spinner, the hub loads. You should NOT see the legacy password prompt. The hub just works.
6. Look at the nav bar: `Dashboard` link near the left, your user pill near the right, `Sign out` button at the far right.
7. Click around — visit a policy page (`SG-POL-001.html`). The nav on that page should also show Dashboard / user pill / Sign out.

### Step 5 — Test the Admin link behavior

1. As a Coordinator, the **Admin** menu item in the nav (on any page) should go directly to `admin.html` (Firebase admin panel).
2. If you had a Volunteer account, the Admin item would be hidden.

### Step 6 — Test that a new volunteer doesn't see the legacy prompt

1. Sign out.
2. Sign up with a fresh email (your second email).
3. Verify, fill the profile, land on dashboard.
4. Click the **Hub** link in the nav. You should see the hub content directly — no password prompt at all.

### Troubleshooting

**"I see the legacy password prompt after signing in" —** The `/config/hub` doc isn't set up. Redo Step 3.

**"Anonymous visitors can see the hub" —** The deploy didn't pick up the new `index.html`. Hard refresh, or re-check Step 1 uploaded to `auth-feature`.

**"The Dashboard link / user pill / Sign out aren't showing in the nav on policy pages" —** Hard refresh (Cmd+Shift+R). Your browser cached the old `sg-nav.js`.

**"Checking sign-in…" spinner stuck forever —** Open the browser console (right-click → Inspect → Console). If you see a Firestore permission error, the rules weren't republished. Redo Step 2.

---

---

## Phase 5 deploy — make the dashboard actionable

Turns the 4 "Coming soon" cards on the volunteer dashboard into real onboarding steps. Covenant gets signed; police check gets tracked; references get collected; training gets marked complete. Coordinators see all of this on each user's detail page.

### Step 1 — Upload to `auth-feature`

**Switch GitHub branch dropdown to `auth-feature` first.** Upload these 8 files:

**New (4):**
- `covenant.html`
- `police-check.html`
- `references.html`
- `training.html`

**Replaces (4):**
- `sg-profile.js` (adds covenant/police/references/training helpers)
- `sg-admin.js` (adds coordinator-only compliance helpers)
- `dashboard.html` (real data, clickable steps — no more "Coming soon")
- `admin-user.html` (new Compliance section for coordinators)

Commit message:
```
Phase 5: make onboarding steps actionable (covenant, police check, references, training)
```

Wait for green checkmark on Actions. No Firestore rules change needed.

### Step 2 — Customize the Worker's Covenant text

The covenant in `covenant.html` is starter text. Review and edit it to match Bethany Chapel's statement of faith, specific ministry commitments, and any legal phrasing you want. Edit the sections inside `covenant.html` (search for `<h3>` and the list items under each).

Once you've edited it locally, re-upload `covenant.html` to the `auth-feature` branch.

### Step 3 — Test as a volunteer (your own account)

1. Go to your dashboard: https://stophoto.github.io/safeguard-hub/dashboard.html
2. Hard refresh (Cmd+Shift+R).
3. You should see 5 step cards under "Next steps" (not "Coming soon" anymore):
   - Complete your profile — marked Done if you've done profile setup
   - Sign the Worker's Covenant — with a **Start →** or **View →** link
   - Police Information Check — with a link
   - Two references — with a link
   - Safeguard training — with a link
4. Click each "Start →" and walk through the step. Save at each one.
5. Come back to the dashboard — the progress bar climbs as you complete steps.

### Step 4 — Test as Coordinator: marking things

1. Go to Admin, click **Open →** on your own (or a test volunteer's) row.
2. Scroll to the new **Compliance** section. You should see:
   - Covenant status (read-only — only the volunteer can sign)
   - Police check — with two date fields and Save/Undo buttons
   - References — list with per-row "Mark received" buttons
   - Training status (read-only summary)
3. Try marking a police check cleared: pick a date → click **Save clearance** → the status updates, and the volunteer's dashboard renewal date populates automatically.
4. If the volunteer has saved references, mark one received → the badge updates.

### Step 5 — Confirm it all flows together

1. On the Admin page, look at your row. Your status/role is what you set.
2. Once a volunteer completes all 5 steps (profile, covenant, 2 refs received, police cleared, all training modules), they're ready to be **Activated** — change their status from "In-process" to "Active" via the status dropdown in Admin.
3. (Phase 6 could auto-prompt for activation when all 5 steps are done. For now, it's a manual status change.)

### Troubleshooting

**"Permission denied" when signing covenant / submitting police check:**
- The Firestore rules need to be current. Open https://console.firebase.google.com/project/safeguard-hub-71292/firestore/rules — verify the rules match the latest `firestore.rules` file. If not, republish.

**Dashboard still shows "Coming soon":**
- Browser cache. Cmd+Shift+R on dashboard.html.

**Training modules don't open when clicking "View module":**
- The training pages (SG-T-*.html) are existing static HTML. They should exist on the auth-feature branch already — they were uploaded with the original files.

---

---

## Phase 6 deploy — Activation workflow

Adds a one-click "Activate volunteer" flow to the admin panel. When a volunteer completes all 5 onboarding steps (profile, covenant, police check cleared, 2 references received, all training modules), they appear in a new **Ready for activation** section at the top of the Admin page. One click flips their status to "active" and optionally opens a pre-written welcome email.

### Step 1 — Upload to `auth-feature`

**Switch GitHub branch dropdown to `auth-feature` first.** Upload these 4 files:

- `sg-profile.js` (adds `isReadyForActivation` + `trainingModulesFor` helpers)
- `sg-admin.js` (adds `activateUser` helper)
- `admin.html` (adds "Ready for activation" section at top of People page)
- `admin-user.html` (adds green activation banner + "Open welcome email" mailto)

Commit message:
```
Phase 6: activation workflow with welcome email
```

No Firestore rules change needed. Wait for green checkmark on Actions.

### Step 2 — Test with a real candidate

1. Sign in as your Coordinator account.
2. You (or a test volunteer) need all 5 steps done:
   - Profile complete ✓
   - Covenant signed ✓
   - Police check marked cleared (you do this from the admin side)
   - Both references marked received (admin side)
   - All 4 volunteer training modules marked complete (or 7 for Leaders)
3. Once everything's done, open https://stophoto.github.io/safeguard-hub/admin.html
4. **Expected:** a green "Ready for activation" section appears at the top of the page, listing that volunteer with an **Activate** button.
5. Click **Activate** → the volunteer's status flips to "active" and they disappear from the Ready section.

### Step 3 — Test the welcome email flow

1. Before activating, click **Review →** on the ready candidate — you land on `admin-user.html`.
2. You'll see a new green "Ready for activation" banner near the top.
3. Click **Open welcome email** — your email client opens with a pre-written message addressed to the volunteer.
4. Review the message and send it from your email client.
5. Then click **Activate this volunteer** to flip their status.

### How the "ready" check works

A profile is flagged as ready when ALL of these are true:
- `profileComplete === true`
- `covenant.signed === true`
- `policeCheck.clearedAt` has a value (not just submitted)
- `references.items` has at least 2 items where `receivedAt` is set
- Every training module in their role's required list has `completedAt` set
  - Volunteers: SG-T-001 through SG-T-004
  - Leaders & Coordinators: all of the above plus SG-T-101 through SG-T-103
- AND status is currently "in-process" (not already active or paused)

Coordinators can still manually change status at any time via the Status dropdown — the activation banner is just a smart shortcut for the common case.

---

---

## Phase 7 deploy — Form submissions captured in Firestore

Every fillable form in the Hub (Ministry Application, Incident Report, Suspected Abuse Report, Training Record, Reference Check, Covenant Ack, Child Registration) now writes a copy to Firestore in parallel with the existing Google Sheets write. Coordinators get a new **Submissions** view in the admin panel to triage every form that comes in — without switching to Sheets.

Sheets writes stay on during this transition. If Firestore capture ever fails, the legacy Sheets path is unaffected. This is intentional — we're still in belt-and-suspenders mode.

### Step 1 — Upload to `auth-feature`

**Switch GitHub branch dropdown to `auth-feature` first.** Upload these 6 files:

- `sg-submissions.js` (new)
- `admin-submissions.html` (new — list view)
- `admin-submission.html` (new — single submission detail view)
- `index.html` (replaces — now hooks every SheetsService submit into Firestore)
- `admin.html` (replaces — adds "Admin · Submissions" link to nav)
- `firestore.rules` (replaces — adds `/submissions` collection rules)

Commit message:
```
Phase 7: capture form submissions to Firestore + admin submissions viewer
```

Wait for green checkmark on Actions.

### Step 2 — Republish the Firestore Security Rules

Rules changed (new `/submissions` collection). If you skip this, submissions will silently fail to save.

1. Copy `firestore.rules` contents on your Mac (Cmd+A, Cmd+C).
2. Go to https://console.firebase.google.com/project/safeguard-hub-71292/firestore/rules
3. Click inside the editor → Cmd+A → Delete → Cmd+V
4. Click **Publish**.

### Step 3 — Test the capture flow

1. Sign into the Hub as any user. Navigate to any fillable form (e.g., **Forms → Incident / Accident Report**).
2. Fill it in and submit.
3. You should see the usual "Incident reported. Record: INC-..." success message (Sheets path worked).
4. Now go to **Admin · Submissions** from the top nav. Hard refresh (Cmd+Shift+R).
5. The new submission should appear at the top of the list, with status **Open**.
6. Click **Open →** on the row. You land on the detail view showing every field by name (for forms with registered schemas) or as "Field 1/2/3…" labels (for forms without schemas yet).
7. Change status to **Reviewed**, add a note, click **Save triage**. Refresh the list — the badge updates.

### Step 4 — Confirm the Firestore document looks right

1. Go to https://console.firebase.google.com/project/safeguard-hub-71292/firestore/data
2. Click the new **submissions** collection.
3. Open the document. You should see fields:
   - `formCode`, `formTitle`, `tabName`, `recordId`
   - `rowData` (array — the exact row sent to Sheets)
   - `submittedBy` (your Firebase uid), `submittedByEmail`, `submittedAt`
   - `status` ("open" initially, updated via admin triage)

### What's still on the Sheets path

- All 7 forms still write to Google Sheets. Nothing is turned off yet.
- When you're confident Firestore capture is working (a week or two of real submissions), we can flip a flag to stop writing to Sheets entirely. That's Phase 7b.

### Adding schema headers to more forms

Right now only **SG-FRM-001 (Ministry Application)** has a full header schema in `sg-submissions.js`. The other forms' `rowData` arrays show as "Field 1 / Field 2 / …" in the detail view. To add headers, edit the `FORM_SCHEMAS` map in `sg-submissions.js` — add a `headers: [...]` array for each form, with one string per column in the order the form writes them.

---

---

## Phase 8 deploy — Unified user chip + form autofill

Two refinements rolled into one phase:

1. **Unified user chip** — every page's top nav now ends with a single clickable chip (avatar + first name + role + caret). Clicking it opens a Google-style dropdown with **My dashboard · Edit profile · Account settings · Sign out**. The old standalone "Dashboard" link and "Sign out" button are gone — everything account-related lives in the chip dropdown.
2. **Form autofill** — when you open any of the 4 main fillable forms in the Hub (Ministry Application, Incident Report, Abuse Report, Covenant Acknowledgement), fields like *Your name*, *Email*, *Phone*, *Date of birth* are auto-filled from your profile. You can still edit anything — autofill never overwrites typed values.

### Step 1 — Upload to `auth-feature`

**Switch GitHub branch dropdown to `auth-feature` first.** Upload these 14 files:

**New (1):**
- `sg-user-chip.js`

**Replaces (13):**
- `sg-nav.js` (uses the new chip instead of old pill/signout)
- `dashboard.html`
- `admin.html`
- `admin-user.html`
- `admin-submissions.html`
- `admin-submission.html`
- `profile-setup.html`
- `invite.html`
- `covenant.html`
- `police-check.html`
- `references.html`
- `training.html`
- `index.html` (adds profile caching + autofill helper)

**Optional:**
- `FIREBASE-SETUP.md` (this file)

Commit message:
```
Phase 8: unified user chip menu + form autofill
```

No Firestore rules change. Wait for green checkmark on Actions.

### Step 2 — Test the user chip

1. Sign in and go to the dashboard. Hard refresh (Cmd+Shift+R).
2. Look at the top nav. At the far right you should see: a gold circle with your first initial, your first name in white, your role in gold below it, and a small caret.
3. Click the chip. A white dropdown appears with:
   - Large avatar, your full name, your email, gold role pill
   - My dashboard
   - Edit profile
   - Account settings (greyed out — placeholder for future)
   - Sign out (red)
4. Click outside → dropdown closes. Press Esc → closes. Click a menu item → navigates and closes.
5. Resize the window narrow (< 640px). The chip collapses to just the avatar circle.
6. Visit admin, admin-submissions, covenant, training, policy pages, the hub — the chip should appear and behave the same on all of them.

### Step 3 — Test the form autofill

1. Go to the Hub. Navigate to **Forms → Ministry Application** (or any fillable form).
2. The "Full Legal Name", "Email", "Phone", and "Date of Birth" fields should already be populated from your profile.
3. Clear the "Full Legal Name" field and type something different — autofill won't overwrite what you typed. That's by design.
4. Refresh the page — the autofilled values return (you haven't submitted yet).

### What autofills on which form

| Form | Autofilled fields |
|---|---|
| [SG-FRM-001](https://stophoto.github.io/safeguard-hub/index.html#frm001) Ministry Application | Full name, email, phone, date of birth |
| [SG-FRM-006](https://stophoto.github.io/safeguard-hub/index.html#frm006) Incident Report | Reporter name |
| [SG-FRM-007](https://stophoto.github.io/safeguard-hub/index.html#frm007) Abuse Report | Reporter name, reporter email, reporter phone |
| [SG-FRM-004](https://stophoto.github.io/safeguard-hub/covenant.html) Covenant Acknowledgement | Full name |

### Troubleshooting

**Chip doesn't appear on a page:** the page's module script didn't upload correctly. Hard refresh. If still missing, verify the page has `<div id="userChip"></div>` in its header and the module script imports `mountUserChip` from `./sg-user-chip.js`.

**Autofill isn't happening:** the profile cache isn't loading. Open the page and check the browser console (right-click → Inspect → Console). Look for any red errors about `sg-profile.js` or permissions.

**Old "Sign out" button still showing:** browser cache. Cmd+Shift+R.

---

*Last updated: April 2026 · Phase 8 complete*
