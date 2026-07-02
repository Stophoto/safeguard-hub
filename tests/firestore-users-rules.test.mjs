// Firestore security-rules tests — users / invites / config / leadNotifications
// ─────────────────────────────────────────────────────────────────────────
// Second pass: the places a rules slip would be most serious beyond the
// abuseReports read model —
//   • Privilege escalation: a volunteer cannot lift their own role/status or
//     grant themselves safeguard flags.
//   • Separation of duties: a coordinator manages profiles but cannot grant
//     safeguard_lead; only a Safeguard Lead Admin can, and only with MFA.
//   • Coordinator-only collections: invites, config.
//   • leadNotifications: Lead Admin creates, Safeguard Leads read.
//
// Emulator-only, demo- project id (isolated namespace), no production data.
// Run with:  npm run test:rules
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { before, after, describe, it } from "node:test";

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const PROJECT_ID = "demo-safeguard-hub-users";
const RULES_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "firestore.rules");

let testEnv;
const db = {};
const VERIFIED = (email) => ({ email, email_verified: true });
const future = () => Timestamp.fromMillis(Date.now() + 3600_000);
// Coordinator-written follow-up stamp on refVolunteer's police check (B-1).
const FOLLOW_UP = "2026-06-01T00:00:00.000Z";

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adb = ctx.firestore();
    const baseVolunteer = (email) => ({
      email, role: "volunteer", status: "in-process",
      safeguard_lead: false, safeguard_lead_admin: false, mfaEnrolled: false,
    });

    // Personas
    await setDoc(doc(adb, "users/volunteer"), baseVolunteer("vol@example.org"));
    await setDoc(doc(adb, "users/coordinator"), {
      email: "coord@example.org", role: "coordinator", status: "active",
      safeguard_lead: false, safeguard_lead_admin: false, mfaEnrolled: false,
    });
    await setDoc(doc(adb, "users/lead"), {
      email: "lead@example.org", role: "volunteer", status: "active",
      safeguard_lead: true, safeguard_lead_admin: false, mfaEnrolled: true,
    });
    await setDoc(doc(adb, "users/leadAdmin"), {
      email: "leadadmin@example.org", role: "volunteer", status: "active",
      safeguard_lead: false, safeguard_lead_admin: true, mfaEnrolled: true,
    });

    // Dedicated mutation targets (so tests don't stomp each other / order-free)
    await setDoc(doc(adb, "users/grantTargetA"), baseVolunteer("grantA@example.org"));
    await setDoc(doc(adb, "users/grantTargetB"), baseVolunteer("grantB@example.org"));
    await setDoc(doc(adb, "users/coordTarget"), baseVolunteer("coordtarget@example.org"));
    await setDoc(doc(adb, "users/tempTarget"), baseVolunteer("temptarget@example.org"));
    await setDoc(doc(adb, "users/roleTarget"), baseVolunteer("roletarget@example.org"));

    // A volunteer with coordinator-written compliance state, to prove
    // self-service still works around pinned fields (B-1) and that
    // received references are locked (B-2).
    await setDoc(doc(adb, "users/refVolunteer"), {
      ...baseVolunteer("refvol@example.org"),
      policeCheck: { submittedAt: "2026-01-15", followUpAt: FOLLOW_UP },
      references: { items: [
        { name: "Jane Reference", email: "jane@example.org", relationship: "Friend", receivedAt: "2026-02-01" },
        { name: "Bob Reference", email: "bob@example.org", relationship: "Pastor", receivedAt: null },
      ] },
    });

    // Coordinator-only collections
    await setDoc(doc(adb, "invites/existing"), {
      email: "invitee@example.org", role: "volunteer", createdAt: Timestamp.now(),
    });
    await setDoc(doc(adb, "config/site"), { featureFlags: { x: true } });

    // leadNotifications
    await setDoc(doc(adb, "leadNotifications/note-1"), {
      type: "temporaryAbuseAccess", targetUid: "tempTarget", reportId: "report-1",
      reason: "investigating", grantedBy: "leadAdmin",
      grantedByEmail: "leadadmin@example.org",
      grantedAt: Timestamp.now(), expiresAt: future(),
    });
  });

  db.unauth = testEnv.unauthenticatedContext().firestore();
  db.volunteer = testEnv.authenticatedContext("volunteer", VERIFIED("vol@example.org")).firestore();
  db.coordinator = testEnv.authenticatedContext("coordinator", VERIFIED("coord@example.org")).firestore();
  db.lead = testEnv.authenticatedContext("lead", VERIFIED("lead@example.org")).firestore();
  db.leadAdmin = testEnv.authenticatedContext("leadAdmin", VERIFIED("leadadmin@example.org")).firestore();
  db.refVolunteer = testEnv.authenticatedContext("refVolunteer", VERIFIED("refvol@example.org")).firestore();
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

const getOne = (d, path) => getDoc(doc(d, path));
const listAll = (d, col) => getDocs(query(collection(d, col)));

// ───────────────────────────────────────────────────────────────────────
describe("users — read access", () => {
  it("unauthenticated cannot read a profile", async () => {
    await assertFails(getOne(db.unauth, "users/volunteer"));
  });
  it("volunteer can read their OWN profile", async () => {
    await assertSucceeds(getOne(db.volunteer, "users/volunteer"));
  });
  it("volunteer cannot read another user's profile", async () => {
    await assertFails(getOne(db.volunteer, "users/coordinator"));
  });
  it("coordinator can read any profile", async () => {
    await assertSucceeds(getOne(db.coordinator, "users/volunteer"));
  });
});

// ───────────────────────────────────────────────────────────────────────
describe("users — self-update privilege escalation", () => {
  it("volunteer can edit their own ordinary profile field", async () => {
    await assertSucceeds(
      updateDoc(doc(db.volunteer, "users/volunteer"), { firstName: "Updated", updatedAt: serverTimestamp() }),
    );
  });
  it("KEY: volunteer CANNOT change their own role", async () => {
    await assertFails(updateDoc(doc(db.volunteer, "users/volunteer"), { role: "coordinator" }));
  });
  it("KEY: volunteer CANNOT change their own status", async () => {
    await assertFails(updateDoc(doc(db.volunteer, "users/volunteer"), { status: "active" }));
  });
  it("KEY: volunteer CANNOT grant themselves safeguard_lead", async () => {
    await assertFails(updateDoc(doc(db.volunteer, "users/volunteer"), { safeguard_lead: true }));
  });
  it("KEY: volunteer CANNOT grant themselves safeguard_lead_admin", async () => {
    await assertFails(updateDoc(doc(db.volunteer, "users/volunteer"), { safeguard_lead_admin: true }));
  });
});

// ───────────────────────────────────────────────────────────────────────
describe("users — coordinator updates (separation of duties)", () => {
  it("coordinator can change another user's status", async () => {
    await assertSucceeds(updateDoc(doc(db.coordinator, "users/coordTarget"), { status: "active" }));
  });
  it("KEY: coordinator CANNOT grant safeguard_lead", async () => {
    await assertFails(updateDoc(doc(db.coordinator, "users/coordTarget"), { safeguard_lead: true }));
  });
});

// ───────────────────────────────────────────────────────────────────────
describe("users — safeguard-access grants (Lead Admin only, MFA required)", () => {
  it("Lead Admin can grant safeguard_lead WITH mfaEnrolled", async () => {
    await assertSucceeds(
      updateDoc(doc(db.leadAdmin, "users/grantTargetA"), {
        safeguard_lead: true, mfaEnrolled: true,
        updatedAt: serverTimestamp(), updatedBy: "leadAdmin",
      }),
    );
  });
  it("KEY: Lead Admin CANNOT grant safeguard_lead without MFA", async () => {
    await assertFails(
      updateDoc(doc(db.leadAdmin, "users/grantTargetB"), {
        safeguard_lead: true, mfaEnrolled: false,
        updatedAt: serverTimestamp(), updatedBy: "leadAdmin",
      }),
    );
  });
  it("KEY: coordinator CANNOT grant safeguard_lead", async () => {
    await assertFails(
      updateDoc(doc(db.coordinator, "users/grantTargetB"), {
        safeguard_lead: true, mfaEnrolled: true,
        updatedAt: serverTimestamp(), updatedBy: "coordinator",
      }),
    );
  });
});

// ───────────────────────────────────────────────────────────────────────
describe("users — temporary abuse-access grant (Lead Admin only)", () => {
  it("Lead Admin can set a valid temporaryAbuseAccess grant", async () => {
    await assertSucceeds(
      updateDoc(doc(db.leadAdmin, "users/tempTarget"), {
        temporaryAbuseAccess: {
          grantedBy: "leadAdmin", grantedByEmail: "leadadmin@example.org",
          grantedAt: serverTimestamp(), expiresAt: future(),
          reason: "investigating report-1", reportId: "report-1",
        },
        updatedAt: serverTimestamp(), updatedBy: "leadAdmin",
      }),
    );
  });
  it("KEY: coordinator CANNOT set a temporaryAbuseAccess grant", async () => {
    await assertFails(
      updateDoc(doc(db.coordinator, "users/tempTarget"), {
        temporaryAbuseAccess: {
          grantedBy: "coordinator", grantedByEmail: "coord@example.org",
          grantedAt: serverTimestamp(), expiresAt: future(),
          reason: "nope", reportId: "report-1",
        },
        updatedAt: serverTimestamp(), updatedBy: "coordinator",
      }),
    );
  });
});

// ───────────────────────────────────────────────────────────────────────
describe("invites — coordinator only", () => {
  it("coordinator can read an invite", async () => {
    await assertSucceeds(getOne(db.coordinator, "invites/existing"));
  });
  it("coordinator can list invites", async () => {
    await assertSucceeds(listAll(db.coordinator, "invites"));
  });
  it("coordinator can create an invite", async () => {
    await assertSucceeds(
      setDoc(doc(db.coordinator, "invites/new-invite"), {
        email: "new@example.org", role: "volunteer", createdAt: serverTimestamp(),
      }),
    );
  });
  it("volunteer cannot read invites", async () => {
    await assertFails(getOne(db.volunteer, "invites/existing"));
  });
  it("volunteer cannot list invites", async () => {
    await assertFails(listAll(db.volunteer, "invites"));
  });
  it("volunteer cannot create an invite", async () => {
    await assertFails(setDoc(doc(db.volunteer, "invites/sneaky"), { email: "x@example.org" }));
  });
  it("no one can delete an invite from the app", async () => {
    await assertFails(deleteDoc(doc(db.coordinator, "invites/existing")));
  });
});

// ───────────────────────────────────────────────────────────────────────
describe("config — coordinator read, no writes from the app", () => {
  it("coordinator can read config", async () => {
    await assertSucceeds(getOne(db.coordinator, "config/site"));
  });
  it("volunteer cannot read config", async () => {
    await assertFails(getOne(db.volunteer, "config/site"));
  });
  it("coordinator cannot write config", async () => {
    await assertFails(updateDoc(doc(db.coordinator, "config/site"), { featureFlags: { x: false } }));
  });
});

// ───────────────────────────────────────────────────────────────────────
describe("leadNotifications — Lead Admin creates, Leads read", () => {
  const validNotification = (uid, email) => ({
    type: "temporaryAbuseAccess", targetUid: "tempTarget", reportId: "report-1",
    reason: "investigating", grantedBy: uid, grantedByEmail: email,
    grantedAt: serverTimestamp(), expiresAt: future(),
  });

  it("Lead Admin can create a valid notification", async () => {
    await assertSucceeds(
      setDoc(doc(db.leadAdmin, "leadNotifications/note-new"), validNotification("leadAdmin", "leadadmin@example.org")),
    );
  });
  it("KEY: coordinator CANNOT create a lead notification", async () => {
    await assertFails(
      setDoc(doc(db.coordinator, "leadNotifications/note-bad"), validNotification("coordinator", "coord@example.org")),
    );
  });
  it("Safeguard Lead can get a notification", async () => {
    await assertSucceeds(getOne(db.lead, "leadNotifications/note-1"));
  });
  it("Safeguard Lead can list notifications", async () => {
    await assertSucceeds(listAll(db.lead, "leadNotifications"));
  });
  it("volunteer cannot get a notification", async () => {
    await assertFails(getOne(db.volunteer, "leadNotifications/note-1"));
  });
  it("volunteer cannot list notifications", async () => {
    await assertFails(listAll(db.volunteer, "leadNotifications"));
  });
  it("no one can delete a notification from the app", async () => {
    await assertFails(deleteDoc(doc(db.leadAdmin, "leadNotifications/note-1")));
  });
});

// ───────────────────────────────────────────────────────────────────────
// Role changes are owner-tier only: coordinators can no longer promote
// anyone, and nobody — not even a Lead Admin — can change their own role.
describe("users — role changes are Lead Admin (owner tier) only", () => {
  it("KEY: coordinator CANNOT promote anyone to coordinator", async () => {
    await assertFails(
      updateDoc(doc(db.coordinator, "users/roleTarget"), {
        role: "coordinator", updatedAt: serverTimestamp(), updatedBy: "coordinator",
      }),
    );
  });
  it("KEY: coordinator CANNOT change a role at all (even to leader)", async () => {
    await assertFails(
      updateDoc(doc(db.coordinator, "users/roleTarget"), {
        role: "leader", updatedAt: serverTimestamp(), updatedBy: "coordinator",
      }),
    );
  });
  it("KEY: Lead Admin CANNOT change their OWN role", async () => {
    await assertFails(
      updateDoc(doc(db.leadAdmin, "users/leadAdmin"), {
        role: "coordinator", updatedAt: serverTimestamp(), updatedBy: "leadAdmin",
      }),
    );
  });
  it("Lead Admin cannot smuggle other fields into a role change", async () => {
    await assertFails(
      updateDoc(doc(db.leadAdmin, "users/roleTarget"), {
        role: "leader", status: "active",
        updatedAt: serverTimestamp(), updatedBy: "leadAdmin",
      }),
    );
  });
  it("role must be a known value", async () => {
    await assertFails(
      updateDoc(doc(db.leadAdmin, "users/roleTarget"), {
        role: "superuser", updatedAt: serverTimestamp(), updatedBy: "leadAdmin",
      }),
    );
  });
  it("Lead Admin CAN change another user's role", async () => {
    await assertSucceeds(
      updateDoc(doc(db.leadAdmin, "users/roleTarget"), {
        role: "coordinator", updatedAt: serverTimestamp(), updatedBy: "leadAdmin",
      }),
    );
  });
});

// ───────────────────────────────────────────────────────────────────────
// A coordinator manages OTHER people. Their own compliance must be
// recorded by someone else — no self-clearing, self-approval, or
// self-activation.
describe("users — coordinator cannot manage their OWN record", () => {
  it("KEY: coordinator CANNOT set their own police clearance", async () => {
    await assertFails(
      updateDoc(doc(db.coordinator, "users/coordinator"), {
        policeCheck: { clearedAt: "2026-01-01", expiresOn: "2029-01-01" },
        updatedAt: serverTimestamp(), updatedBy: "coordinator",
      }),
    );
  });
  it("KEY: coordinator CANNOT change their own status", async () => {
    await assertFails(
      updateDoc(doc(db.coordinator, "users/coordinator"), { status: "paused" }),
    );
  });
  it("KEY: coordinator CANNOT approve their own screening", async () => {
    await assertFails(
      updateDoc(doc(db.coordinator, "users/coordinator"), {
        screening: { approval: { decision: "approved", approvedBy: "me", date: "2026-01-01" } },
        updatedAt: serverTimestamp(), updatedBy: "coordinator",
      }),
    );
  });
  it("coordinator CAN still edit their own name (volunteer self path)", async () => {
    await assertSucceeds(
      updateDoc(doc(db.coordinator, "users/coordinator"), {
        firstName: "Casey", updatedAt: serverTimestamp(),
      }),
    );
  });
  it("coordinator status writes must use a known value", async () => {
    await assertFails(
      updateDoc(doc(db.coordinator, "users/coordTarget"), { status: "bogus-status" }),
    );
  });
});

// ───────────────────────────────────────────────────────────────────────
// Safeguard access flags: a second person must grant them, and the top
// (Lead Admin) flag requires the 2FA marker just like the lead flag.
describe("users — safeguard access: no self-grants, MFA on the admin flag", () => {
  it("KEY: Lead Admin CANNOT grant safeguard flags to THEMSELVES", async () => {
    await assertFails(
      updateDoc(doc(db.leadAdmin, "users/leadAdmin"), {
        safeguard_lead: true, mfaEnrolled: true,
        updatedAt: serverTimestamp(), updatedBy: "leadAdmin",
      }),
    );
  });
  it("KEY: Lead Admin CANNOT grant safeguard_lead_admin without MFA", async () => {
    await assertFails(
      updateDoc(doc(db.leadAdmin, "users/grantTargetB"), {
        safeguard_lead_admin: true, mfaEnrolled: false,
        updatedAt: serverTimestamp(), updatedBy: "leadAdmin",
      }),
    );
  });
  it("Lead Admin CAN grant safeguard_lead_admin with MFA", async () => {
    await assertSucceeds(
      updateDoc(doc(db.leadAdmin, "users/grantTargetB"), {
        safeguard_lead_admin: true, mfaEnrolled: true,
        updatedAt: serverTimestamp(), updatedBy: "leadAdmin",
      }),
    );
  });
  it("KEY: Lead Admin CANNOT grant temporary abuse access to THEMSELVES", async () => {
    await assertFails(
      updateDoc(doc(db.leadAdmin, "users/leadAdmin"), {
        temporaryAbuseAccess: {
          grantedBy: "leadAdmin", grantedByEmail: "leadadmin@example.org",
          grantedAt: serverTimestamp(), expiresAt: future(),
          reason: "self grant attempt", reportId: "report-1",
        },
        updatedAt: serverTimestamp(), updatedBy: "leadAdmin",
      }),
    );
  });
});

// ───────────────────────────────────────────────────────────────────────
// B-1 regression: a coordinator-written followUpAt stamp on the police
// check must never lock the volunteer out of ordinary self-service.
describe("users — self-service works around coordinator-written policeCheck fields (B-1)", () => {
  it("volunteer with a followUpAt flag CAN still edit unrelated fields", async () => {
    await assertSucceeds(
      updateDoc(doc(db.refVolunteer, "users/refVolunteer"), {
        firstName: "Still Works", updatedAt: serverTimestamp(),
      }),
    );
  });
  it("volunteer CAN update their police submittedAt (pinned fields preserved)", async () => {
    await assertSucceeds(
      updateDoc(doc(db.refVolunteer, "users/refVolunteer"), {
        policeCheck: { submittedAt: "2026-07-01", followUpAt: FOLLOW_UP },
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("KEY: volunteer CANNOT clear the coordinator's followUpAt flag", async () => {
    await assertFails(
      updateDoc(doc(db.refVolunteer, "users/refVolunteer"), {
        policeCheck: { submittedAt: "2026-07-01" },
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("KEY: volunteer CANNOT set their own clearedAt", async () => {
    await assertFails(
      updateDoc(doc(db.refVolunteer, "users/refVolunteer"), {
        policeCheck: { submittedAt: "2026-07-01", followUpAt: FOLLOW_UP, clearedAt: "2026-07-01" },
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

// ───────────────────────────────────────────────────────────────────────
// B-2 regression: once a reference is marked received, the volunteer can
// no longer change WHO vouched, remove it, or smuggle extra data.
describe("users — received references are locked (B-2)", () => {
  const jane = { name: "Jane Reference", email: "jane@example.org", relationship: "Friend", receivedAt: "2026-02-01" };
  const bob  = { name: "Bob Reference",  email: "bob@example.org",  relationship: "Pastor", receivedAt: null };

  it("KEY: volunteer CANNOT rewrite who vouched after receipt", async () => {
    await assertFails(
      updateDoc(doc(db.refVolunteer, "users/refVolunteer"), {
        references: { items: [ { ...jane, name: "Impostor", email: "impostor@example.org" }, bob ] },
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("KEY: volunteer CANNOT remove a received reference", async () => {
    await assertFails(
      updateDoc(doc(db.refVolunteer, "users/refVolunteer"), {
        references: { items: [ bob ] },
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("KEY: volunteer CANNOT hide extra data inside references", async () => {
    await assertFails(
      updateDoc(doc(db.refVolunteer, "users/refVolunteer"), {
        references: { items: [ jane, bob ], smuggled: "extra" },
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("volunteer CAN edit a not-yet-received reference", async () => {
    await assertSucceeds(
      updateDoc(doc(db.refVolunteer, "users/refVolunteer"), {
        references: { items: [ jane, { name: "New Bob", email: "newbob@example.org", relationship: "Mentor", receivedAt: null } ] },
        updatedAt: serverTimestamp(),
      }),
    );
  });
});
