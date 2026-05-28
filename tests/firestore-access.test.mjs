// Firestore security-rules tests — Safeguard Hub
// ─────────────────────────────────────────────────────────────────────────
// Scope (first pass): WHO can read/list/update/delete the two sensitive
// collections, by role:
//   unauthenticated · volunteer · coordinator · Safeguard Lead · Lead Admin
//
// The headline safeguarding properties pinned down here:
//   • abuseReports get/list require safeguard_lead == true ONLY — not
//     coordinator, and not safeguard_lead_admin on its own.
//   • A coordinator can read/list /submissions (the legacy-exposure surface)
//     but CANNOT read /abuseReports.
//   • The migration property: identical SG-FRM-007 content is coordinator-
//     readable in /submissions, but closed to coordinators in /abuseReports.
//
// Emulator-only. Uses a demo- project id, so it never touches production.
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
  deleteDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const PROJECT_ID = "demo-safeguard-hub-rules";
const RULES_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "firestore.rules");

let testEnv;

// Verified-email token claims for create paths that require them.
const VERIFIED = (email) => ({ email, email_verified: true });

// Persona contexts (each backed by a seeded /users/{uid} profile below).
const db = {};

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  await testEnv.clearFirestore();

  // ── Seed profiles + data with rules disabled (admin context) ──────────
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adb = ctx.firestore();

    // Roles are independent flags on the user's own profile doc.
    await setDoc(doc(adb, "users/volunteer"), {
      email: "vol@example.org", role: "volunteer",
      safeguard_lead: false, safeguard_lead_admin: false,
    });
    await setDoc(doc(adb, "users/coordinator"), {
      email: "coord@example.org", role: "coordinator",
      safeguard_lead: false, safeguard_lead_admin: false,
    });
    // Lead is intentionally NOT a coordinator, to isolate what the
    // safeguard_lead flag alone grants.
    await setDoc(doc(adb, "users/lead"), {
      email: "lead@example.org", role: "volunteer",
      safeguard_lead: true, safeguard_lead_admin: false,
    });
    // Lead Admin WITHOUT the lead flag, to prove admin-ness alone does not
    // grant abuse-report reads.
    await setDoc(doc(adb, "users/leadAdmin"), {
      email: "leadadmin@example.org", role: "volunteer",
      safeguard_lead: false, safeguard_lead_admin: true,
    });
    // A volunteer granted time-boxed access to ONE report.
    await setDoc(doc(adb, "users/tempViewer"), {
      email: "temp@example.org", role: "volunteer",
      safeguard_lead: false, safeguard_lead_admin: false,
      temporaryAbuseAccess: {
        reportId: "report-1",
        expiresAt: Timestamp.fromMillis(Date.now() + 3600_000),
      },
    });

    // ── submissions ──
    // A legacy suspected-abuse report still sitting in /submissions
    // (owned by someone else) — the exact exposure the migration closes.
    await setDoc(doc(adb, "submissions/legacy-abuse-1"), {
      formCode: "SG-FRM-007", tabName: "Abuse Reports",
      submittedBy: "reporter-uid", submittedByEmail: "reporter@example.org",
      recordId: "AB-1", rowData: ["child initials", "concern details"],
      status: "open", notes: "",
    });
    // An ordinary submission owned by the volunteer persona.
    await setDoc(doc(adb, "submissions/own-1"), {
      formCode: "SG-FRM-001", tabName: "People",
      submittedBy: "volunteer", submittedByEmail: "vol@example.org",
      recordId: "P-1", rowData: ["x"], status: "open", notes: "",
    });
    // An ordinary submission owned by someone else.
    await setDoc(doc(adb, "submissions/other-1"), {
      formCode: "SG-FRM-001", tabName: "People",
      submittedBy: "reporter-uid", submittedByEmail: "reporter@example.org",
      recordId: "P-2", rowData: ["y"], status: "open", notes: "",
    });

    // ── abuseReports (post-migration location) ──
    for (const id of ["report-1", "report-2"]) {
      await setDoc(doc(adb, `abuseReports/${id}`), {
        schemaVersion: 1, formCode: "SG-FRM-007", tabName: "Abuse Reports",
        submittedBy: "reporter-uid", submittedByEmail: "reporter@example.org",
        recordId: id, rowData: ["child initials", "concern details"],
        status: "open", assignedLeadUid: null, allowedReaders: [],
        reviewedBy: null, reviewedByEmail: null, reviewedAt: null,
        closedBy: null, closedAt: null, closureReason: "", notes: "",
        legalHold: true, retentionUntil: null,
        createdVia: "legacy-submissions-migration",
        legacySubmissionId: id, migratedAt: Timestamp.now(),
      });
    }
  });

  // ── Build persona DB handles ──────────────────────────────────────────
  db.unauth = testEnv.unauthenticatedContext().firestore();
  db.volunteer = testEnv.authenticatedContext("volunteer", VERIFIED("vol@example.org")).firestore();
  db.volunteerUnverified = testEnv
    .authenticatedContext("volunteer", { email: "vol@example.org", email_verified: false })
    .firestore();
  db.coordinator = testEnv.authenticatedContext("coordinator", VERIFIED("coord@example.org")).firestore();
  db.lead = testEnv.authenticatedContext("lead", VERIFIED("lead@example.org")).firestore();
  db.leadAdmin = testEnv.authenticatedContext("leadAdmin", VERIFIED("leadadmin@example.org")).firestore();
  db.tempViewer = testEnv.authenticatedContext("tempViewer", VERIFIED("temp@example.org")).firestore();
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

const getOne = (d, path) => getDoc(doc(d, path));
const listAll = (d, col) => getDocs(query(collection(d, col)));

// ───────────────────────────────────────────────────────────────────────
describe("submissions — read/list access by role", () => {
  it("unauthenticated cannot get a submission", async () => {
    await assertFails(getOne(db.unauth, "submissions/own-1"));
  });
  it("unauthenticated cannot list submissions", async () => {
    await assertFails(listAll(db.unauth, "submissions"));
  });

  it("volunteer can get their OWN submission", async () => {
    await assertSucceeds(getOne(db.volunteer, "submissions/own-1"));
  });
  it("volunteer cannot get someone else's submission", async () => {
    await assertFails(getOne(db.volunteer, "submissions/other-1"));
  });
  it("volunteer cannot get a legacy abuse report in submissions", async () => {
    await assertFails(getOne(db.volunteer, "submissions/legacy-abuse-1"));
  });
  it("volunteer cannot list submissions", async () => {
    await assertFails(listAll(db.volunteer, "submissions"));
  });

  it("coordinator can get any submission", async () => {
    await assertSucceeds(getOne(db.coordinator, "submissions/other-1"));
  });
  it("coordinator can list submissions", async () => {
    await assertSucceeds(listAll(db.coordinator, "submissions"));
  });
  it("EXPOSURE: coordinator CAN read a legacy abuse report still in submissions", async () => {
    await assertSucceeds(getOne(db.coordinator, "submissions/legacy-abuse-1"));
  });

  it("Safeguard Lead (non-coordinator) cannot list submissions", async () => {
    await assertFails(listAll(db.lead, "submissions"));
  });
  it("Lead Admin (non-coordinator) cannot list submissions", async () => {
    await assertFails(listAll(db.leadAdmin, "submissions"));
  });

  it("no one can delete a submission from the app", async () => {
    await assertFails(deleteDoc(doc(db.coordinator, "submissions/own-1")));
  });
});

// ───────────────────────────────────────────────────────────────────────
describe("abuseReports — read/list access by role", () => {
  it("unauthenticated cannot get an abuse report", async () => {
    await assertFails(getOne(db.unauth, "abuseReports/report-1"));
  });
  it("unauthenticated cannot list abuse reports", async () => {
    await assertFails(listAll(db.unauth, "abuseReports"));
  });

  it("volunteer cannot get an abuse report", async () => {
    await assertFails(getOne(db.volunteer, "abuseReports/report-1"));
  });
  it("volunteer cannot list abuse reports", async () => {
    await assertFails(listAll(db.volunteer, "abuseReports"));
  });

  it("KEY: coordinator CANNOT get an abuse report", async () => {
    await assertFails(getOne(db.coordinator, "abuseReports/report-1"));
  });
  it("KEY: coordinator CANNOT list abuse reports", async () => {
    await assertFails(listAll(db.coordinator, "abuseReports"));
  });

  it("KEY: Lead Admin (without the lead flag) CANNOT get an abuse report", async () => {
    await assertFails(getOne(db.leadAdmin, "abuseReports/report-1"));
  });
  it("KEY: Lead Admin (without the lead flag) CANNOT list abuse reports", async () => {
    await assertFails(listAll(db.leadAdmin, "abuseReports"));
  });

  it("Safeguard Lead CAN get an abuse report", async () => {
    await assertSucceeds(getOne(db.lead, "abuseReports/report-1"));
  });
  it("Safeguard Lead CAN list abuse reports", async () => {
    await assertSucceeds(listAll(db.lead, "abuseReports"));
  });
  it("no one can delete an abuse report from the app", async () => {
    await assertFails(deleteDoc(doc(db.lead, "abuseReports/report-1")));
  });
});

// ───────────────────────────────────────────────────────────────────────
describe("abuseReports — temporary, time-boxed access", () => {
  it("temp viewer CAN get the one report they were granted", async () => {
    await assertSucceeds(getOne(db.tempViewer, "abuseReports/report-1"));
  });
  it("temp viewer CANNOT get a different report", async () => {
    await assertFails(getOne(db.tempViewer, "abuseReports/report-2"));
  });
  it("temp viewer CANNOT list abuse reports (grant is per-report)", async () => {
    await assertFails(listAll(db.tempViewer, "abuseReports"));
  });
});

// ───────────────────────────────────────────────────────────────────────
describe("migration property — moving the data closes the exposure", () => {
  it("BEFORE: SG-FRM-007 content in /submissions is readable by a coordinator", async () => {
    await assertSucceeds(getOne(db.coordinator, "submissions/legacy-abuse-1"));
  });
  it("AFTER: the same content in /abuseReports is NOT readable by a coordinator", async () => {
    await assertFails(getOne(db.coordinator, "abuseReports/report-1"));
  });
  it("AFTER: it remains readable by a Safeguard Lead", async () => {
    await assertSucceeds(getOne(db.lead, "abuseReports/report-1"));
  });
});

// ───────────────────────────────────────────────────────────────────────
describe("submissions — create boundaries (sanity)", () => {
  const validSubmission = (uid, email) => ({
    formCode: "SG-FRM-001", formTitle: "People", tabName: "People",
    recordId: "new-1", rowData: ["a", "b"],
    submittedBy: uid, submittedByEmail: email, submittedAt: serverTimestamp(),
    status: "open", reviewedBy: null, reviewedByEmail: null, reviewedAt: null,
    notes: "",
  });

  it("verified volunteer can create a valid submission as themselves", async () => {
    await assertSucceeds(
      setDoc(doc(db.volunteer, "submissions/create-ok"), validSubmission("volunteer", "vol@example.org")),
    );
  });
  it("volunteer cannot create a submission impersonating another user", async () => {
    await assertFails(
      setDoc(doc(db.volunteer, "submissions/create-imp"), validSubmission("reporter-uid", "reporter@example.org")),
    );
  });
  it("unverified-email user cannot create a submission", async () => {
    await assertFails(
      setDoc(doc(db.volunteerUnverified, "submissions/create-unverified"), validSubmission("volunteer", "vol@example.org")),
    );
  });
});
