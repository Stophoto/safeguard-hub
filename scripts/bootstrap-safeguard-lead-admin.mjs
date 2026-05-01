#!/usr/bin/env node

// One-time Phase A bootstrap for F-01.
//
// Before running, replace CHRIS_FIREBASE_UID with Chris Prefontaine's
// Firebase Auth UID. Keep the same UID in firestore.rules, then remove
// both bootstrap hooks after Christine has been granted access in-app.
//
// Required environment:
//   FIREBASE_ID_TOKEN: a fresh Firebase Auth ID token for Chris.
//
// This script is intentionally not wired into package.json and should not
// be run during review. It updates only /users/{CHRIS_FIREBASE_UID}.

const PROJECT_ID = "safeguard-hub-71292";
const CHRIS_FIREBASE_UID = "CHRIS_FIREBASE_UID_TO_FILL_BEFORE_RUNNING";

if (CHRIS_FIREBASE_UID === "CHRIS_FIREBASE_UID_TO_FILL_BEFORE_RUNNING") {
  throw new Error("Fill CHRIS_FIREBASE_UID before running this one-time bootstrap.");
}

const token = process.env.FIREBASE_ID_TOKEN;
if (!token) {
  throw new Error("Set FIREBASE_ID_TOKEN to Chris's fresh Firebase Auth ID token.");
}

const url = new URL(
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${CHRIS_FIREBASE_UID}`,
);

[
  "updateMask.fieldPaths=safeguard_lead",
  "updateMask.fieldPaths=safeguard_lead_admin",
  "updateMask.fieldPaths=mfaEnrolled",
].forEach((part) => {
  const [key, value] = part.split("=");
  url.searchParams.append(key, value);
});

const res = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    fields: {
      safeguard_lead: { booleanValue: true },
      safeguard_lead_admin: { booleanValue: true },
      mfaEnrolled: { booleanValue: true },
    },
  }),
});

if (!res.ok) {
  const body = await res.text();
  throw new Error(`Bootstrap failed: ${res.status} ${body}`);
}

console.log(`Bootstrapped safeguard_lead_admin on users/${CHRIS_FIREBASE_UID}.`);
