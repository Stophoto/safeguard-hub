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

### Phase 2 — Profile + volunteer dashboard
- New pages: `profile-setup.html`, `dashboard.html`
- Firestore starts holding `users/{uid}` documents with personal info,
  emergency contact, ministry preferences (age groups, service times)
- First Firestore Security Rules added

### Phase 3 — Admin / coordinator
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

*Last updated: April 2026 · Phase 1 complete*
