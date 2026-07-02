# One-time setup: let the site publish its own security rules

You do this **once, ever.** After it's done, the security rules publish
themselves automatically whenever they change — you never touch Firebase or
GitHub again for this.

**Why this one step needs you:** publishing to Firebase is locked to *your*
Google account (the same lock that stops anyone else from changing your
security settings). To let the automation act on your behalf, you hand it a
"key" — once. That's this setup.

Two short parts, about 2–3 minutes total.

---

## Part 1 — Get the key from Google (Firebase)

1. Open this page (sign in with your project's Google account if asked):
   **https://console.firebase.google.com/project/safeguard-hub-71292/settings/serviceaccounts/adminsdk**

2. You'll see a section titled **Firebase Admin SDK**. Click the button
   **Generate new private key**.

3. A warning pops up ("Keep it confidential"). Click **Generate key**.

4. A file downloads to your computer — a `.json` file (its name starts with
   `safeguard-hub-71292-...`). This is the key. Treat it like a password:
   don't email it or put it anywhere public. You'll paste its contents in
   Part 2, then you can delete the file.

---

## Part 2 — Give the key to the automation (GitHub)

1. Open this page (sign in if asked):
   **https://github.com/Stophoto/safeguard-hub/settings/secrets/actions**

2. Click the green button **New repository secret** (top right).

3. In **Name**, type exactly (all caps, with underscores):

   ```
   FIREBASE_SERVICE_ACCOUNT
   ```

4. For **Secret**: open the `.json` file you downloaded in Part 1 with any
   text editor (on a Mac: right-click → Open With → TextEdit). Select
   everything (`⌘A`), copy (`⌘C`), and paste it into the big **Secret** box.
   It's a big block of text that starts with `{` and ends with `}` — that's
   correct.

5. Click **Add secret**.

6. Done. You can now delete the `.json` file from your computer — the key is
   safely stored.

---

## That's it — here's what happens from now on

- Whenever I (or anyone) change the security rules, GitHub **runs all 90
  safety tests first**. If even one fails, it **refuses to publish** — broken
  rules can never reach your live site.
- If the tests pass, it publishes to Firebase automatically. No console, no
  copy-paste, no clicking Publish.

### Want to publish right now, by hand, without changing anything?
Once setup is done, you can trigger it anytime:
1. Go to **https://github.com/Stophoto/safeguard-hub/actions/workflows/publish-rules.yml**
2. Click **Run workflow** → **Run workflow**.
It runs the tests and publishes in about a minute.

### If it ever fails
GitHub emails you. Open the **Actions** tab, click the red run, and send me
what it says — I'll sort it out. A failed run never changes your live site.

The most common first-time hiccup: the message mentions **"permission"** or
**"PERMISSION_DENIED"**. That just means the key needs one extra checkbox —
the right to publish rules. It's a 30-second fix in Google Cloud (grant the
service account the **Firebase Rules Admin** role), and I'll give you the
exact click-path if it comes up. Nothing to worry about — it can't break
anything, it just means "not allowed yet."
