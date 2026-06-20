// sg-application.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// Single source of truth for the Ministry Application (SG-FRM-001)
// business logic: building the People submission row, gathering
// age-group / service-time selections, the youth test, record-id
// generation, and field validators.
//
// Extracted VERBATIM from SG-FRM-001.html so the People rowData
// column order is byte-identical no matter which page submits
// (the legacy single-scroll form OR the new onboarding wizard).
//
// IMPORTANT: the order of the values pushed in buildRowData() MUST
// stay aligned with FORM_SCHEMAS.People.headers in sg-submissions.js.
// A console.assert at the bottom guards against drift.
// ─────────────────────────────────────────────────────────────

import { FORM_SCHEMAS } from "./sg-submissions.js";

// ── Field model ─────────────────────────────────────────────
// The application is described as a flat model object. Every key
// here is the canonical field name the wizard (and any future
// caller) populates. Defaults keep buildRowData() total even when
// a branch (e.g. youth) was never filled.
export function emptyApplication() {
  return {
    // Section 1 — personal
    fullName: "", dob: "", email: "",
    phoneHome: "", phoneCell: "",
    address: "", city: "", province: "", postal: "",

    // Section 2 — spiritual background
    attendLength: "",
    services: "", member: "", baptized: "", baptismOpen: "",
    journey: "",

    // Section 3 — ministry experience
    c1Name: "", c1Phone: "", c1Dates: "", c1Status: "", c1Roles: "",
    c2Name: "", c2Phone: "", c2Dates: "", c2Status: "", c2Roles: "",

    // Section 4 — ministry preferences
    ageGroups: [],        // subset of ["nursery","preschool","elementary","youth"]
    serviceTimes: [],     // subset of ["9am","11am","wed-pm","special"]
    skills: "",

    // Section 5 — safety screening
    ss1: "", ss2: "", ss3: "", ss4: "", ss5: "",
    ssExplain: "",

    // Section 6 — references
    r1Name: "", r1Phone: "", r1Email: "", r1Rel: "", r1Years: "",
    r2Name: "", r2Phone: "", r2Email: "", r2Rel: "", r2Years: "",

    // Section 7 — declaration & consent (signature only on the row)
    dec1: false, dec2: false, dec3: false, dec4: false,
    appSig: "", appSigDate: "", appConsent: false,

    // Witness — NOT collected in the volunteer flow; coordinator
    // counter-signs later. Stored empty to preserve column order.
    witSig: "", witSigDate: "",

    // Section 8 — junior volunteers (under 16)
    grade: "", parentName: "", parentPhone: "",
    parentsSupport: "",
    yFaith: "", yWhy: "", yGifts: "", yConcerns: "",
    yExp: "",
    yr1Name: "", yr1PE: "", yr1Rel: "",
    yr2Name: "", yr2PE: "", yr2Rel: "",

    // Section 9 — junior declaration & parent/guardian consent
    yd1: false, yd2: false, yd3: false,
    youthSig: "", youthSigDate: "", youthConsent: false,
    pc1: false,
    pgSig: "", pgSigDate: "", pgConsent: false,
    // Witness / ministry leader on the consent — coordinator-side, empty.
    wlSig: "", wlSigDate: "",
  };
}

// ── Age groups → ordered list (matches SG-FRM-001 order) ────
// Accepts the application model; returns the canonical array.
export function gatherAgeGroups(app) {
  const sel = (app && Array.isArray(app.ageGroups)) ? app.ageGroups : [];
  const arr = [];
  if (sel.includes("nursery"))    arr.push("nursery");
  if (sel.includes("preschool"))  arr.push("preschool");
  if (sel.includes("elementary")) arr.push("elementary");
  if (sel.includes("youth"))      arr.push("youth");
  return arr;
}

// ── Service times → ordered list (matches SG-FRM-001 order) ──
// In FRM-001 a single "Sunday Morning" checkbox expands to both
// "9am" and "11am". The wizard models the three checkboxes the
// same way, so we accept either the raw set or the expanded set.
export function gatherServiceTimes(app) {
  const sel = (app && Array.isArray(app.serviceTimes)) ? app.serviceTimes : [];
  const sunday = sel.includes("sunday") || sel.includes("9am") || sel.includes("11am");
  const arr = [];
  if (sunday) { arr.push("9am"); arr.push("11am"); }
  if (sel.includes("wed-pm")) arr.push("wed-pm");
  if (sel.includes("special")) arr.push("special");
  return arr;
}

// ── Youth test (same rule as SG-FRM-001) ────────────────────
// Treat as youth if any Section 8/9 field is filled OR DOB < 16y.
export function isYouth(app) {
  if (!app) return false;
  const textKeys = ["grade","parentName","parentPhone","yFaith","yWhy","yGifts","yConcerns","yExp","youthSig","pgSig"];
  if (textKeys.some(k => (app[k] || "").toString().trim())) return true;
  const dob = app.dob;
  if (dob) {
    const birth = new Date(dob);
    if (!isNaN(birth.getTime())) {
      const ageYears = (Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (ageYears < 16) return true;
    }
  }
  return false;
}

// ── Age in years from a YYYY-MM-DD DOB (null if unparseable) ─
export function ageFromDob(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  return (Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

// ── Record id (same format as SG-FRM-001: APP-YYYYMMDD-HHMMSS) ─
export function generateRecordId() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  const ymd = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  const hms = p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  return "APP-" + ymd + "-" + hms;
}

// ── Today as YYYY-MM-DD (local) ─────────────────────────────
export function todayIso() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

// ── Build the People submission row ─────────────────────────
// Column order is byte-identical to SG-FRM-001.html buildRowData().
// `app` is the application model; `recordId` + `submittedAt` are
// supplied by the caller so they can be reused in the profile snapshot.
export function buildRowData(app, recordId, submittedAt) {
  const a = app || {};
  const s = v => (v == null ? "" : String(v).trim());
  const raw = v => (v == null ? "" : String(v));     // dates: no trim needed but keep as-is
  const underEighteen = isYouth(a);

  return [
    recordId,
    s(a.fullName), raw(a.dob), underEighteen ? "Youth" : "Adult",
    s(a.email), s(a.phoneHome), s(a.phoneCell),
    s(a.address), s(a.city), s(a.province), s(a.postal),
    raw(a.attendLength), raw(a.services), raw(a.member), raw(a.baptized), raw(a.baptismOpen),
    s(a.journey),
    s(a.c1Name), s(a.c1Phone), raw(a.c1Dates), raw(a.c1Status), s(a.c1Roles),
    s(a.c2Name), s(a.c2Phone), raw(a.c2Dates), raw(a.c2Status), s(a.c2Roles),
    gatherAgeGroups(a).join("; "), gatherServiceTimes(a).join("; "), s(a.skills),
    raw(a.ss1), raw(a.ss2), raw(a.ss3), raw(a.ss4), raw(a.ss5),
    s(a.ssExplain),
    s(a.r1Name), s(a.r1Phone), s(a.r1Email), s(a.r1Rel), raw(a.r1Years),
    s(a.r2Name), s(a.r2Phone), s(a.r2Email), s(a.r2Rel), raw(a.r2Years),
    s(a.appSig), raw(a.appSigDate),
    s(a.witSig), raw(a.witSigDate),
    raw(a.grade), s(a.parentName), s(a.parentPhone),
    raw(a.parentsSupport),
    s(a.yFaith), s(a.yWhy), s(a.yGifts), s(a.yConcerns),
    s(a.yExp),
    s(a.yr1Name), s(a.yr1PE), s(a.yr1Rel),
    s(a.yr2Name), s(a.yr2PE), s(a.yr2Rel),
    s(a.youthSig), raw(a.youthSigDate),
    s(a.pgSig), raw(a.pgSigDate),
    s(a.wlSig), raw(a.wlSigDate),
    submittedAt || new Date().toISOString(),
  ];
}

// ── Validators ──────────────────────────────────────────────
// Each returns an array of human-readable missing/invalid labels.
// Used per-step by the wizard and again at final submit.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePersonal(a) {
  const e = [];
  if (!s(a.fullName)) e.push("Full name");
  if (!s(a.dob))      e.push("Date of birth");
  if (!s(a.email))    e.push("Email");
  else if (!EMAIL_RE.test(s(a.email))) e.push("A valid email");
  if (!s(a.phoneCell)) e.push("Cell phone");
  return e;
}

export function validateAddress(a) {
  const e = [];
  if (!s(a.address))  e.push("Street address");
  if (!s(a.city))     e.push("City");
  if (!s(a.province)) e.push("Province");
  if (!s(a.postal))   e.push("Postal code");
  return e;
}

export function validateSpiritual(a) {
  const e = [];
  if (!s(a.attendLength)) e.push("How long you've attended");
  if (!s(a.journey))      e.push("Your spiritual journey");
  return e;
}

// Experience (Section 3) is optional — no required fields.
export function validateExperience() { return []; }

export function validatePreferences(a) {
  const e = [];
  const ages = gatherAgeGroups(a);
  if (ages.length === 0) e.push("At least one age group");
  return e;
}

export function validateScreening(a) {
  const e = [];
  ["ss1","ss2","ss3","ss4","ss5"].forEach((k, i) => {
    if (!s(a[k])) e.push("Screening question " + (i + 1));
  });
  const anyYes = ["ss1","ss2","ss3","ss4","ss5"].some(k => s(a[k]) === "yes");
  if (anyYes && !s(a.ssExplain)) e.push("Explanation for your “Yes” answer(s)");
  return e;
}

export function validateReferences(a) {
  const e = [];
  if (!s(a.r1Name)) e.push("Reference 1 name");
  if (!s(a.r1Email)) e.push("Reference 1 email");
  else if (!EMAIL_RE.test(s(a.r1Email))) e.push("A valid Reference 1 email");
  if (!s(a.r1Rel))  e.push("Reference 1 relationship");
  if (!s(a.r2Name)) e.push("Reference 2 name");
  if (!s(a.r2Email)) e.push("Reference 2 email");
  else if (!EMAIL_RE.test(s(a.r2Email))) e.push("A valid Reference 2 email");
  if (!s(a.r2Rel))  e.push("Reference 2 relationship");
  return e;
}

// Adult declarations (Section 7)
export function validateDeclarations(a) {
  const e = [];
  if (!a.dec1) e.push("Declaration 1");
  if (!a.dec2) e.push("Declaration 2");
  if (!a.dec3) e.push("Declaration 3");
  if (!a.dec4) e.push("Declaration 4");
  if (!s(a.appSig)) e.push("Your signature");
  if (!a.appConsent) e.push("Signature attestation");
  return e;
}

// Youth detail (Section 8)
export function validateYouthDetail(a) {
  const e = [];
  if (!s(a.parentName))  e.push("Parent/guardian name");
  if (!s(a.parentPhone)) e.push("Parent/guardian phone");
  if (!s(a.parentsSupport)) e.push("Whether your parents are supportive");
  if (!s(a.yFaith)) e.push("What your faith means to you");
  if (!s(a.yWhy))   e.push("Why you'd like to serve");
  if (!s(a.yr1Name)) e.push("Youth reference 1 name");
  if (!s(a.yr1PE))   e.push("Youth reference 1 phone/email");
  if (!s(a.yr2Name)) e.push("Youth reference 2 name");
  if (!s(a.yr2PE))   e.push("Youth reference 2 phone/email");
  return e;
}

// Youth declaration + parent consent (Section 9)
export function validateYouthDeclarations(a) {
  const e = [];
  if (!a.yd1) e.push("Junior declaration 1");
  if (!a.yd2) e.push("Junior declaration 2");
  if (!a.yd3) e.push("Junior declaration 3");
  if (!s(a.youthSig)) e.push("Your signature");
  if (!a.youthConsent) e.push("Your signature attestation");
  if (!a.pc1) e.push("Parent/guardian consent");
  if (!s(a.pgSig)) e.push("Parent/guardian signature");
  if (!a.pgConsent) e.push("Parent/guardian signature attestation");
  return e;
}

function s(v) { return v == null ? "" : String(v).trim(); }

// ── Drift guard ─────────────────────────────────────────────
// If the People header count and the rowData length ever diverge,
// this fires loudly in the console so the contract can be fixed.
try {
  const probe = buildRowData(emptyApplication(), "PROBE", new Date().toISOString());
  const headerCount = (FORM_SCHEMAS && FORM_SCHEMAS.People && FORM_SCHEMAS.People.headers)
    ? FORM_SCHEMAS.People.headers.length : -1;
  console.assert(
    probe.length === headerCount,
    "sg-application: People rowData length (" + probe.length +
    ") != header count (" + headerCount + ") — column contract drift!"
  );
} catch (_) { /* never block load on the guard */ }
