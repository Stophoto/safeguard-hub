// functions/index.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// Callable Cloud Function: createInvitedUser
//
// Why this exists:
//   Creating a Firebase Auth account from the browser with the
//   Admin features we need (no password, custom claims) trips
//   `auth/admin-restricted-operation`. Account creation must run
//   server-side with the Admin SDK. This is that server side.
//
// What it does (handoff §6):
//   1. Verify the CALLER is a coordinator/admin (custom claim).
//   2. admin.auth().createUser({ email, displayName, emailVerified:false })
//   3. setCustomUserClaims(uid, { role, ministryArea })  ← bakes access level
//   4. Write users/{uid} profile stub: status:'invited', profileComplete:false
//   5. generatePasswordResetLink(email, actionCodeSettings)  ← activation link
//   6. If sendEmail → hand off to mail service; ALWAYS return the link too.
// ─────────────────────────────────────────────────────────────

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// Where the invitee lands after clicking the link. The action code
// (oobCode) is appended by Firebase automatically.
const ACTIVATE_URL = "https://stophoto.github.io/safeguard-hub/activate.html";

const VALID_ROLES = ["volunteer", "leader", "coordinator"];

// Roles allowed to issue invites. Accept both the codebase's
// "coordinator" and the handoff's "admin" so either claim works.
const INVITER_ROLES = ["coordinator", "admin"];

export const createInvitedUser = onCall(async (request) => {
  const auth = request.auth;

  // ── 1. AuthN + AuthZ ──────────────────────────────────────
  if (!auth) {
    throw new HttpsError("unauthenticated", "Sign in first.");
  }
  const callerRole = auth.token.role;
  if (!INVITER_ROLES.includes(callerRole)) {
    throw new HttpsError(
      "permission-denied",
      "Only a coordinator can invite volunteers."
    );
  }

  // ── Validate input ────────────────────────────────────────
  const name = String(request.data?.name || "").trim();
  const email = String(request.data?.email || "").trim().toLowerCase();
  const role = String(request.data?.role || "volunteer").trim();
  const ministryArea = String(request.data?.ministryArea || "").trim();
  const prospectId = request.data?.prospectId
    ? String(request.data.prospectId).trim()
    : null;
  const sendEmail = request.data?.sendEmail === true;

  if (!email || !email.includes("@")) {
    throw new HttpsError("invalid-argument", "A valid email is required.");
  }
  if (!VALID_ROLES.includes(role)) {
    throw new HttpsError("invalid-argument", `Invalid role: ${role}`);
  }
  // Only a coordinator may mint another coordinator.
  if (role === "coordinator" && callerRole !== "coordinator" && callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Cannot grant coordinator access.");
  }

  const adminAuth = getAuth();
  const db = getFirestore();

  // ── 2. Create the account (or adopt an existing stub) ─────
  let userRecord;
  try {
    userRecord = await adminAuth.createUser({
      email,
      displayName: name || undefined,
      emailVerified: false,
    });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      // Re-inviting someone who already has an account: reuse it,
      // refresh their claims and re-issue a link. Do NOT clobber an
      // already-activated user's status.
      userRecord = await adminAuth.getUserByEmail(email);
    } else {
      console.error("createUser failed", err);
      throw new HttpsError("internal", "Could not create the account.");
    }
  }
  const uid = userRecord.uid;

  // ── 3. Bake access level into a custom claim ──────────────
  await adminAuth.setCustomUserClaims(uid, { role, ministryArea });

  // ── 4. Write the profile stub ─────────────────────────────
  // merge:true so re-inviting never erases existing data. We only
  // set status:'invited' when the doc doesn't already exist or is
  // still a prospect — never demote an activated user.
  const ref = db.collection("users").doc(uid);
  const existing = await ref.get();
  const prior = existing.exists ? existing.data() : null;
  const isFreshInvite =
    !prior || ["prospect", "invited"].includes(prior.status);

  const stub = {
    email,
    name,
    displayName: name,
    role,
    ministryArea,
    profileComplete: false,
    invitedBy: auth.uid,
    invitedByEmail: auth.token.email || null,
    invitedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (isFreshInvite) stub.status = "invited";

  // Carry over prospect data (handoff §6.3) if a prospectId is given.
  if (prospectId) {
    const prospectSnap = await db.collection("prospects").doc(prospectId).get();
    if (prospectSnap.exists) {
      const p = prospectSnap.data();
      stub.attendingSince = p.attendanceStart || stub.attendingSince || "";
      stub.phone = p.phone || stub.phone || "";
      stub.whyNote = p.whyNote || "";
      stub.isYouthHelper = p.isYouthHelper === true;
      await prospectSnap.ref.set(
        { status: "invited", invitedUid: uid, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  }

  await ref.set(stub, { merge: true });

  // ── 5. Generate the activation link ───────────────────────
  // A password-reset link doubles as a first-time "set password"
  // link. continueUrl is where Firebase sends them after the code
  // is consumed; we also handle the code directly on activate.html.
  const actionCodeSettings = {
    url: ACTIVATE_URL,
    handleCodeInApp: false,
  };

  let activationLink;
  try {
    activationLink = await adminAuth.generatePasswordResetLink(
      email,
      actionCodeSettings
    );
  } catch (err) {
    console.error("generatePasswordResetLink failed", err);
    throw new HttpsError(
      "internal",
      "Account was created but the activation link could not be generated."
    );
  }

  // ── 6. Optionally email the link ──────────────────────────
  let emailSent = false;
  if (sendEmail) {
    try {
      await sendActivationEmail({ to: email, name, link: activationLink });
      emailSent = true;
    } catch (err) {
      // Non-fatal: the admin still gets the link to copy/paste.
      console.error("sendActivationEmail failed", err);
    }
  }

  // Always return the link (copy-link option in the UI).
  return { uid, activationLink, emailSent };
});

// ─────────────────────────────────────────────────────────────
// Mail service hook.
//
// LEFT STUBBED ON PURPOSE — the provider (SendGrid / Mailgun /
// Gmail API) is an owner decision (§4 of the design doc / §10 of
// the handoff). Wiring one in is ~10 lines once a key exists.
//
// SendGrid example (uncomment + `npm i @sendgrid/mail` + set the
// secret with: firebase functions:secrets:set SENDGRID_KEY):
//
//   import sgMail from "@sendgrid/mail";
//   sgMail.setApiKey(process.env.SENDGRID_KEY);
//   await sgMail.send({
//     to, from: "safeguard@bethanychapel.example",
//     subject: "You're invited to the Bethany Chapel Safeguard Hub",
//     text: `Hi ${name || ""},\n\nActivate your account:\n${link}\n`,
//     html: `<p>Hi ${name || ""},</p><p><a href="${link}">Activate your account</a></p>`,
//   });
// ─────────────────────────────────────────────────────────────
async function sendActivationEmail({ to, name, link }) {
  throw new Error(
    "No mail provider configured yet. Use the copy-link option, " +
    "or wire SendGrid/Mailgun/Gmail API into sendActivationEmail()."
  );
}
