# Invite system — drop-in snippets (apply at deploy time)

These are the two edits the plan calls for in EXISTING files. They are kept here
as ready-to-paste snippets so deployment stays a single, deliberate owner step.
Do NOT auto-merge these — apply by hand alongside `firebase deploy`.

The three code artifacts are already in place and need no editing:
- `functions/index.js`        — the `createInvitedUser` callable Cloud Function
- `functions/package.json`    — function dependencies
- `activate.html` (repo root) — the activation page

---

## 1. `firebase.json` — add the `functions` block

The current file only has `firestore` + emulators. Replace its contents with this
(adds `functions` source + runtime, and emulator ports so it can be tested locally
before the Blaze deploy):

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "emulators": {
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "auth": { "port": 9099 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

---

## 2. `firestore.rules` — allow the invited user to self-activate

The invitee must be able to flip their own profile `invited → activated` on first
login. The current `validUserSelfUpdate` forbids changing `status`, so add this
dedicated, tightly-scoped path.

Add this helper inside `service cloud.firestore { match /databases/{database}/documents {`
(next to the other `function ...` helpers):

```
function validActivationSelfUpdate(uid) {
  return request.auth != null
    && request.auth.uid == uid
    && resource.data.status == 'invited'
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['status','activatedAt','email','updatedAt'])
    && request.resource.data.status == 'activated';
}
```

Then, inside `match /users/{uid}`, append it to the existing `allow update:` chain:

```
      allow update: if validUserSelfUpdate(uid)
                    || validActivationSelfUpdate(uid)
                    || validCoordinatorUserUpdate()
                    || validSafeguardAccessUpdate(uid)
                    || validTemporaryAbuseAccessUpdate();
```

> Note: the Cloud Function writes the `invited` profile stub via the Admin SDK,
> which bypasses rules entirely — so no rule change is needed for the *create*
> side. This rule only covers the invitee's own `invited → activated` flip.

---

## 3. Deploy steps (owner-run — see the "needs the owner" list in the handoff)

```bash
cd functions && npm install            # installs admin + functions SDKs
firebase login                         # OWNER step — project owner's Google account
firebase use safeguard-hub-71292       # projectId from sg-firebase.js
firebase deploy --only functions       # requires the Blaze plan
```

Local dry-run without touching prod:
`firebase emulators:start --only functions,auth,firestore`

### Bootstrap the first inviter (one-time, owner-run)

The function requires the *caller* to already hold a `role` claim of
`coordinator`/`admin`. Existing coordinators were bootstrapped via the Firestore
profile doc but have no custom claim yet. Set the first one from a trusted shell:

```bash
firebase functions:shell
> getAuth().getUserByEmail("coordinator@bethanychapel.example")
>   .then(u => getAuth().setCustomUserClaims(u.uid, { role: "coordinator", ministryArea: "" }))
```
