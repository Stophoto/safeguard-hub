// sg-wizard.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// Multi-step onboarding wizard controller. Collects ALL profile +
// application data once and, on submit, writes:
//   1. saveProfile(...)  — core profile fields + programs/childrenAreas
//      + ageGroups/serviceTimes + the full application snapshot under
//      profile.application + profileComplete:true
//   2. saveReferences(...) — the two adult references
//   3. createSubmission({ tabName:"People", rowData, recordId }) — the
//      People row, built by sg-application.js so the column order is
//      byte-identical to the legacy SG-FRM-001 form.
//
// This module is UI-framework-free: it renders into a host element
// and reports state through callbacks. onboarding.html owns the host
// markup, the progress bar, and the nav buttons.
//
// NOTE: this is a NEW parallel flow. It does not modify or replace
// any existing page; profile-setup / SG-FRM-001 stay exactly as-is.
// ─────────────────────────────────────────────────────────────

import { saveProfile, saveReferences } from "./sg-profile.js";
import { createSubmission } from "./sg-submissions.js";
import {
  emptyApplication, gatherAgeGroups, gatherServiceTimes, isYouth,
  ageFromDob, generateRecordId, todayIso, buildRowData,
  validatePersonal, validateAddress, validateSpiritual, validateExperience,
  validatePreferences, validateScreening, validateReferences,
  validateDeclarations, validateYouthDetail, validateYouthDeclarations,
} from "./sg-application.js";

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Christin's "Are you interested in serving with?" vocabulary. The
// volunteer answers serving preferences ONCE via these programs; the
// application's ageGroups/serviceTimes are DERIVED from them so the
// People submission (buildRowData) keeps working without asking twice.
const PROGRAM_OPTIONS = [
  ["sunday-children",  "Sunday Children's program"],
  ["awana",            "Friday Night Awana"],
  ["youth",            "Youth"],
  ["weekday-childcare","Week Day Childcare"],
  ["camp",             "Camp"],
];
const CHILDREN_AREA_OPTIONS = [
  ["preschool",   "Preschool"],
  ["grade-school","Grade School"],
  ["floating",    "Floating Volunteer"],
];

// programs (profile vocabulary) → ageGroups (application vocabulary)
// Loose mapping so a returning profile-setup user arrives with their
// preferences reflected on the application's age-group step, and so the
// People submission row gets sensible age-group columns.
const PROGRAM_TO_AGE = {
  "sunday-children": ["preschool", "elementary"],
  "awana": ["elementary"],
  "youth": ["youth"],
  "weekday-childcare": ["nursery", "preschool"],
  "camp": ["elementary", "youth"],
};

// programs (profile vocabulary) → serviceTimes (application vocabulary).
// gatherServiceTimes() expands "sunday" → 9am+11am; the others map 1:1.
const PROGRAM_TO_TIMES = {
  "sunday-children": ["sunday"],
  "awana": ["special"],          // Friday night — not a regular Sun/Wed slot
  "youth": ["wed-pm"],
  "weekday-childcare": ["special"],
  "camp": ["special"],
};

// Derive the application's ageGroups (canonical order) from programs.
function deriveAgeGroups(programs) {
  const set = new Set();
  (programs || []).forEach(p => (PROGRAM_TO_AGE[p] || []).forEach(g => set.add(g)));
  return ["nursery", "preschool", "elementary", "youth"].filter(g => set.has(g));
}

// Derive the application's serviceTimes from programs.
function deriveServiceTimes(programs) {
  const set = new Set();
  (programs || []).forEach(p => (PROGRAM_TO_TIMES[p] || []).forEach(t => set.add(t)));
  return ["sunday", "wed-pm", "special"].filter(t => set.has(t));
}

// ── Step registry ───────────────────────────────────────────
// Each step: id, title, eyebrow, whether it's youth-only, a render(),
// a read() (DOM → model), and a validate(model) → [errors].
function buildSteps(wiz) {
  return [
    {
      id: "welcome", eyebrow: "Getting started", title: "Let's finish setting you up",
      render: () => renderWelcome(wiz),
      read:   () => readWelcome(wiz),
      validate: (m) => (m.isAdult === true || m.isAdult === false) ? [] : ["Please tell us whether you're 16 or older"],
    },
    {
      id: "personal", eyebrow: "Section 1 · About you", title: "Your personal details",
      render: () => renderPersonal(wiz),
      read:   () => readFields(wiz, ["fullName","dob","email","phoneHome","phoneCell"]),
      validate: validatePersonal,
    },
    {
      id: "address", eyebrow: "Section 1 · About you", title: "Your address",
      render: () => renderAddress(wiz),
      read:   () => readFields(wiz, ["address","city","province","postal"]),
      validate: validateAddress,
    },
    {
      id: "emergency", eyebrow: "About you", title: "Emergency contact",
      render: () => renderEmergency(wiz),
      read:   () => readEmergency(wiz),
      validate: (m) => {
        const e = [];
        const ec = m.emergencyContact || {};
        if (!ec.name) e.push("Emergency contact name");
        if (!ec.phone) e.push("Emergency contact phone");
        if (!ec.relationship) e.push("Relationship to you");
        return e;
      },
    },
    {
      id: "spiritual", eyebrow: "Section 2", title: "Spiritual background",
      render: () => renderSpiritual(wiz),
      read:   () => readSpiritual(wiz),
      validate: validateSpiritual,
    },
    {
      id: "experience", eyebrow: "Section 3", title: "Ministry experience",
      render: () => renderExperience(wiz),
      read:   () => readFields(wiz, ["c1Name","c1Phone","c1Dates","c1Status","c1Roles","c2Name","c2Phone","c2Dates","c2Status","c2Roles"]),
      validate: validateExperience,
    },
    {
      id: "preferences", eyebrow: "Section 4", title: "Where you'd like to serve",
      render: () => renderPreferences(wiz),
      read:   () => readPreferences(wiz),
      validate: validatePreferences,
    },
    {
      id: "screening", eyebrow: "Section 5", title: "Safety screening",
      render: () => renderScreening(wiz),
      read:   () => readScreening(wiz),
      validate: validateScreening,
    },
    {
      id: "references", eyebrow: "Section 6", title: "Two references",
      render: () => renderReferences(wiz),
      read:   () => Object.assign(readFields(wiz, ["r1Name","r1Phone","r1Email","r1Rel","r1Years","r2Name","r2Phone","r2Email","r2Rel","r2Years"]), { referencesLater: chk(wiz, "referencesLater") }),
      validate: (m) => m.referencesLater ? [] : validateReferences(m),
    },
    {
      id: "youth-detail", eyebrow: "Section 8", title: "Junior volunteer details", youthOnly: true,
      render: () => renderYouthDetail(wiz),
      read:   () => readYouthDetail(wiz),
      validate: validateYouthDetail,
    },
    {
      id: "declarations", eyebrow: "Section 7", title: "Declaration & consent",
      render: () => renderDeclarations(wiz),
      read:   () => readDeclarations(wiz),
      validate: (m) => m.isAdult === false
        ? validateYouthDeclarations(m)
        : validateDeclarations(m),
    },
    {
      id: "review", eyebrow: "Almost done", title: "Review your application",
      render: () => renderReview(wiz),
      read:   () => ({}),
      validate: () => [],
    },
    {
      id: "done", eyebrow: "Submitted", title: "Application submitted", terminal: true,
      render: () => renderDone(wiz),
      read:   () => ({}),
      validate: () => [],
    },
  ];
}

// ── Wizard factory ──────────────────────────────────────────
export function createWizard(opts) {
  const wiz = {
    host: opts.host,                       // element the steps render into
    onProgress: opts.onProgress || (() => {}),
    onNavState: opts.onNavState || (() => {}),
    onMessage:  opts.onMessage  || (() => {}),
    model: { ...emptyApplication(), isAdult: null,
             emergencyContact: { name: "", phone: "", relationship: "" },
             programs: [], childrenAreas: [], testimony: "", attendingSince: "",
             preferredName: "", firstName: "", lastName: "" },
    steps: [],
    index: 0,
    submitted: false,
    recordId: "",
  };
  wiz.steps = buildSteps(wiz);

  // Active steps depend on the adult/youth branch.
  wiz.activeSteps = () => wiz.steps.filter(st => {
    if (st.id === "done" && !wiz.submitted) return false;
    if (st.youthOnly && wiz.model.isAdult !== false) return false;
    return true;
  });

  wiz.currentStep = () => wiz.activeSteps()[wiz.index];

  wiz.hydrate = (profile) => hydrate(wiz, profile);
  wiz.render = () => renderCurrent(wiz);
  wiz.next = () => goNext(wiz);
  wiz.back = () => goBack(wiz);
  wiz.goToStepId = (id) => goToStepId(wiz, id);
  wiz.saveLater = () => saveLater(wiz);
  wiz.submit = () => submit(wiz);

  return wiz;
}

// ── Hydrate the model from an existing profile ──────────────
function hydrate(wiz, profile) {
  const m = wiz.model;
  if (!profile) return;

  m.firstName = profile.firstName || "";
  m.lastName = profile.lastName || "";
  m.preferredName = profile.preferredName || "";
  m.fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  m.dob = profile.dob || "";
  m.email = profile.email || "";
  m.phoneCell = profile.phone || "";
  if (profile.address) {
    m.address = profile.address.street || "";
    m.city = profile.address.city || "";
    m.province = profile.address.province || "";
    m.postal = profile.address.postal || "";
  }
  if (profile.emergencyContact) {
    m.emergencyContact = {
      name: profile.emergencyContact.name || "",
      phone: profile.emergencyContact.phone || "",
      relationship: profile.emergencyContact.relationship || "",
    };
  }
  m.programs = Array.isArray(profile.programs) ? [...profile.programs] : [];
  m.childrenAreas = Array.isArray(profile.childrenAreas) ? [...profile.childrenAreas] : [];
  m.testimony = profile.testimony || "";
  m.attendingSince = profile.attendingSince || "";
  if (!m.attendLength && profile.attendingSince) m.attendLength = friendlyAttending(profile.attendingSince);

  // Age groups / service times: prefer the application's own stored set;
  // else derive from the programs answer (the single source of truth now).
  if (Array.isArray(profile.ageGroups) && profile.ageGroups.length) {
    m.ageGroups = [...profile.ageGroups];
  } else if (m.programs.length) {
    m.ageGroups = deriveAgeGroups(m.programs);
  }
  if (Array.isArray(profile.serviceTimes) && profile.serviceTimes.length) {
    m.serviceTimes = normalizeServiceTimes(profile.serviceTimes);
  } else if (m.programs.length) {
    m.serviceTimes = deriveServiceTimes(m.programs);
  }

  // Restore a previously-saved application snapshot (resume).
  const app = profile.application || {};
  Object.keys(emptyApplication()).forEach(k => {
    if (app[k] !== undefined && app[k] !== null && app[k] !== "") {
      m[k] = app[k];
    }
  });
  if (typeof app.isAdult === "boolean") m.isAdult = app.isAdult;
  else if (m.dob != null) {
    const age = ageFromDob(m.dob);
    if (age != null) m.isAdult = age >= 16;
  }

  // Default signature + dates if unset.
  if (!m.appSig) m.appSig = m.fullName;
  if (!m.appSigDate) m.appSigDate = todayIso();
  if (!m.youthSig) m.youthSig = m.fullName;
  if (!m.youthSigDate) m.youthSigDate = todayIso();

  // Resume: land on the first incomplete active step.
  wiz.index = firstIncompleteIndex(wiz);
}

function normalizeServiceTimes(arr) {
  const out = new Set();
  arr.forEach(t => {
    if (t === "9am" || t === "11am" || t === "sunday") out.add("sunday");
    else out.add(t);
  });
  return [...out];
}

function friendlyAttending(ys) {
  if (!/^\d{4}-\d{2}$/.test(ys)) return ys;
  const months = ["","January","February","March","April","May","June","July","August","September","October","November","December"];
  return months[parseInt(ys.slice(5, 7), 10)] + " " + ys.slice(0, 4);
}

function firstIncompleteIndex(wiz) {
  const active = wiz.activeSteps();
  for (let i = 0; i < active.length; i++) {
    const st = active[i];
    if (st.id === "review" || st.id === "done") return i;
    const errs = st.validate(wiz.model) || [];
    if (errs.length) return i;
  }
  return Math.max(0, active.length - 1);
}

// ── Rendering ───────────────────────────────────────────────
function renderCurrent(wiz) {
  const active = wiz.activeSteps();
  if (wiz.index >= active.length) wiz.index = active.length - 1;
  if (wiz.index < 0) wiz.index = 0;
  const step = active[wiz.index];

  wiz.host.innerHTML =
    '<div class="wz-eyebrow">' + esc(step.eyebrow) + '</div>' +
    '<h2 class="wz-title">' + esc(step.title) + '</h2>' +
    '<div class="wz-step-body">' + step.render() + '</div>';

  wireDynamic(wiz, step);

  // Progress: % across active steps (welcome=0 … review=100), done hidden.
  const denom = Math.max(1, active.filter(s => s.id !== "done").length - 1);
  const pct = step.id === "done" ? 100 : Math.round(100 * Math.min(wiz.index, denom) / denom);
  const human = active.filter(s => s.id !== "done");
  const stepNo = Math.min(wiz.index + 1, human.length);
  wiz.onProgress({ pct, label: pct + "% complete · Step " + stepNo + " of " + human.length });

  wiz.onNavState({
    canBack: wiz.index > 0 && !step.terminal,
    showBack: !step.terminal,
    showNext: !step.terminal && step.id !== "review",
    showSubmit: step.id === "review",
    showSaveLater: !step.terminal && step.id !== "welcome" && step.id !== "review",
    nextLabel: "Continue →",
    terminal: !!step.terminal,
    stepId: step.id,
  });
  wiz.onMessage("", "");

  const firstField = wiz.host.querySelector("input, textarea, select");
  if (firstField && step.id !== "review" && step.id !== "done") {
    try { firstField.focus({ preventScroll: true }); } catch (_) {}
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Field helper builders ----------------------------------------------------
function field(id, label, value, opts) {
  opts = opts || {};
  const type = opts.type || "text";
  const ac = opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : "";
  const ph = opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : "";
  const optTag = opts.optional ? ' <span class="opt">— optional</span>' : "";
  return '<div class="field"><label for="wz_' + id + '">' + esc(label) + optTag + '</label>' +
    '<input type="' + type + '" id="wz_' + id + '" class="fi" value="' + esc(value) + '"' + ac + ph + '></div>';
}
function textarea(id, label, value, opts) {
  opts = opts || {};
  const optTag = opts.optional ? ' <span class="opt">— optional</span>' : "";
  const style = opts.minHeight ? ' style="min-height:' + opts.minHeight + 'px"' : "";
  const hint = opts.hint ? '<div class="wz-hint">' + esc(opts.hint) + '</div>' : "";
  return '<div class="field"><label for="wz_' + id + '">' + esc(label) + optTag + '</label>' + hint +
    '<textarea id="wz_' + id + '" class="fi"' + style + '>' + esc(value) + '</textarea></div>';
}
function yesNo(name, value) {
  const y = value === "yes" ? " checked" : "";
  const n = value === "no" ? " checked" : "";
  return '<div class="pills"><label class="pill"><input type="radio" name="' + name + '" value="yes"' + y + '><span>Yes</span></label>' +
    '<label class="pill"><input type="radio" name="' + name + '" value="no"' + n + '><span>No</span></label></div>';
}
function checkPill(name, value, label, checked) {
  return '<label class="pill"><input type="checkbox" name="' + name + '" value="' + value + '"' + (checked ? " checked" : "") + '><span>' + label + '</span></label>';
}

// Welcome -------------------------------------------------------------------
function renderWelcome(wiz) {
  const m = wiz.model;
  const adultChecked = m.isAdult === true ? " checked" : "";
  const youthChecked = m.isAdult === false ? " checked" : "";
  return '<p class="wz-lede">This is the one-time application to serve with children and youth at Bethany Chapel. ' +
    'You\'ll only enter this once — your answers fill your record and the ministry application together. ' +
    'It takes about 10 minutes, and it saves as you go.</p>' +
    '<div class="prompt">First, are you 16 years of age or older?</div>' +
    '<div class="pills"><label class="pill"><input type="radio" name="wz_isAdult" value="adult"' + adultChecked + '><span>Yes, I\'m 16 or older</span></label>' +
    '<label class="pill"><input type="radio" name="wz_isAdult" value="youth"' + youthChecked + '><span>No, I\'m under 16</span></label></div>' +
    '<p class="wz-note">Applicants under 16 complete a few extra questions and need a parent or guardian to consent.</p>';
}
function readWelcome(wiz) {
  const sel = wiz.host.querySelector('input[name="wz_isAdult"]:checked');
  return { isAdult: sel ? (sel.value === "adult") : null };
}

// Personal ------------------------------------------------------------------
function renderPersonal(wiz) {
  const m = wiz.model;
  return '<p class="wz-lede">Some of this may be pre-filled from your account — just check it over.</p>' +
    field("fullName", "Full name", m.fullName, { autocomplete: "name" }) +
    '<div class="row">' +
      field("dob", "Date of birth", m.dob, { type: "date", autocomplete: "bday" }) +
      field("email", "Email", m.email, { type: "email", autocomplete: "email" }) +
    '</div>' +
    '<div class="row">' +
      field("phoneHome", "Phone (home)", m.phoneHome, { type: "tel", optional: true }) +
      field("phoneCell", "Phone (cell)", m.phoneCell, { type: "tel", autocomplete: "tel" }) +
    '</div>';
}

// Address -------------------------------------------------------------------
function renderAddress(wiz) {
  const m = wiz.model;
  return field("address", "Street address", m.address, { autocomplete: "street-address" }) +
    '<div class="row-3">' +
      field("city", "City", m.city, { autocomplete: "address-level2" }) +
      field("province", "Province", m.province, { autocomplete: "address-level1" }) +
      field("postal", "Postal code", m.postal, { autocomplete: "postal-code" }) +
    '</div>';
}

// Emergency -----------------------------------------------------------------
function renderEmergency(wiz) {
  const ec = wiz.model.emergencyContact || {};
  return '<p class="wz-lede">Who we should call if something happens while you\'re serving.</p>' +
    '<div class="row">' +
      field("ecName", "Full name", ec.name) +
      field("ecPhone", "Phone", ec.phone, { type: "tel" }) +
    '</div>' +
    field("ecRel", "Relationship to you", ec.relationship, { placeholder: "Spouse · Parent · Sibling · Friend" });
}
function readEmergency(wiz) {
  return { emergencyContact: {
    name: val(wiz, "ecName"), phone: val(wiz, "ecPhone"), relationship: val(wiz, "ecRel"),
  } };
}

// Spiritual -----------------------------------------------------------------
function renderSpiritual(wiz) {
  const m = wiz.model;
  // One merged faith-story question (replaces the old "spiritual journey" +
  // "faith story" pair). The single field feeds BOTH model.journey (People
  // submission column) and model.testimony (profile) — see readSpiritual.
  // Pre-fill prefers journey but falls back to a previously saved profile
  // testimony so returning volunteers still see their own words.
  const faithStory = m.journey || m.testimony || "";
  return field("attendLength", "How long have you regularly attended Bethany Chapel?", m.attendLength, { placeholder: "e.g., 3 years" }) +
    '<div class="prompt" style="margin-top:14px">Do you attend two or more services per month?</div>' + yesNo("wz_services", m.services) +
    '<div class="prompt">Are you a member of this church?</div>' + yesNo("wz_member", m.member) +
    '<div class="prompt">Have you been baptized?</div>' + yesNo("wz_baptized", m.baptized) +
    '<div class="prompt"><em>If not baptized, are you open to discussing baptism with a pastor?</em></div>' + yesNo("wz_baptismOpen", m.baptismOpen) +
    faithStoryField(faithStory);
}
// Christin's prompt, rendered with a slightly bolder/clearer label and helper
// than the shared textarea() default — the muted 13px hint was easy to miss.
// Styles use the page's existing tokens (Navy label, Teal accent, DM Sans).
function faithStoryField(value) {
  return '<div class="field" style="margin-top:18px">' +
    '<label for="wz_journey" style="font-size:13px;letter-spacing:0.04em">Your faith story</label>' +
    '<div class="wz-hint" style="font-size:13.5px;color:var(--body);font-weight:500;margin-bottom:9px">' +
    esc("We'd love to know your story — how you came to follow Jesus and why you want to serve here. Just a few sentences in your own words; this isn’t a test.") +
    '</div>' +
    '<textarea id="wz_journey" class="fi" style="min-height:150px">' + esc(value) + '</textarea>' +
    '</div>';
}
function readSpiritual(wiz) {
  // The single faith-story textarea (id "journey") populates BOTH the People
  // submission field (model.journey, read by buildRowData) and the profile
  // field (model.testimony, written by profilePayload). validateSpiritual
  // checks model.journey, so requiring this field keeps validation working.
  const faithStory = val(wiz, "journey");
  return {
    attendLength: val(wiz, "attendLength"),
    services: radio(wiz, "wz_services"),
    member: radio(wiz, "wz_member"),
    baptized: radio(wiz, "wz_baptized"),
    baptismOpen: radio(wiz, "wz_baptismOpen"),
    journey: faithStory,
    testimony: faithStory,
  };
}

// Experience ----------------------------------------------------------------
function renderExperience(wiz) {
  const m = wiz.model;
  const statusPills = (name, value) =>
    '<div class="pills"><label class="pill"><input type="radio" name="' + name + '" value="member"' + (value === "member" ? " checked" : "") + '><span>Member</span></label>' +
    '<label class="pill"><input type="radio" name="' + name + '" value="attender"' + (value === "attender" ? " checked" : "") + '><span>Regular Attender</span></label></div>';
  return '<p class="wz-lede">List churches you\'ve attended in the past five years. This whole section is optional.</p>' +
    '<div class="sub-title">Church #1</div>' +
    '<div class="row">' + field("c1Name", "Church name", m.c1Name, { optional: true }) + field("c1Phone", "Phone", m.c1Phone, { type: "tel", optional: true }) + '</div>' +
    field("c1Dates", "Dates attended", m.c1Dates, { optional: true }) + statusPills("wz_c1Status", m.c1Status) +
    field("c1Roles", "Ministry role(s)", m.c1Roles, { optional: true }) +
    '<div class="sub-title">Church #2</div>' +
    '<div class="row">' + field("c2Name", "Church name", m.c2Name, { optional: true }) + field("c2Phone", "Phone", m.c2Phone, { type: "tel", optional: true }) + '</div>' +
    field("c2Dates", "Dates attended", m.c2Dates, { optional: true }) + statusPills("wz_c2Status", m.c2Status) +
    field("c2Roles", "Ministry role(s)", m.c2Roles, { optional: true });
}

// Preferences ---------------------------------------------------------------
// Mirrors Christin's profile-setup "Are you interested in serving with?"
// question. The volunteer picks programs ONCE here; ageGroups/serviceTimes
// (needed by the People submission row) are derived from the programs in
// readPreferences(), so we never ask those a second time.
function renderPreferences(wiz) {
  const m = wiz.model;
  const programs = Array.isArray(m.programs) ? m.programs : [];
  const areas = Array.isArray(m.childrenAreas) ? m.childrenAreas : [];
  const sundayOn = programs.includes("sunday-children");
  return '<div class="prompt">Are you interested in serving with?</div>' +
    '<div class="pills">' +
      PROGRAM_OPTIONS.map(([v, label]) =>
        checkPill("wz_program", v, esc(label), programs.includes(v))
      ).join("") +
    '</div>' +
    '<div class="field" id="wz-children-areas" style="margin-top:18px;display:' + (sundayOn ? "block" : "none") + '">' +
      '<div class="prompt">Within the Sunday Children\'s program, where would you like to serve?</div>' +
      '<div class="pills">' +
        CHILDREN_AREA_OPTIONS.map(([v, label]) =>
          checkPill("wz_childArea", v, esc(label), areas.includes(v))
        ).join("") +
      '</div>' +
    '</div>' +
    textarea("skills", "Any training, experience, skills, or interests relevant to children/youth ministry", m.skills, { minHeight: 120, optional: true });
}
function readPreferences(wiz) {
  const programs = [...wiz.host.querySelectorAll('input[name="wz_program"]:checked')].map(i => i.value);
  // childrenAreas only count when the Sunday Children's program is selected.
  const areas = programs.includes("sunday-children")
    ? [...wiz.host.querySelectorAll('input[name="wz_childArea"]:checked')].map(i => i.value)
    : [];
  // Derive the application vocabulary from the single programs answer so the
  // People submission row (buildRowData → gatherAgeGroups/gatherServiceTimes)
  // still has sensible age-group / service-time columns.
  return {
    programs,
    childrenAreas: areas,
    ageGroups: deriveAgeGroups(programs),
    serviceTimes: deriveServiceTimes(programs),
    skills: val(wiz, "skills"),
  };
}

// Screening -----------------------------------------------------------------
const SCREEN_Q = [
  ["ss1", "Have you ever been convicted of a criminal offense without a pardon?"],
  ["ss2", "Have you ever been investigated by a child welfare agency or similar organization?"],
  ["ss3", "Have you ever been terminated from a position due to allegations of misconduct or abuse?"],
  ["ss4", "Are there any personal circumstances that may affect your ability to work safely with children?"],
  ["ss5", "Do you have any health concerns that may impact your ability to serve?"],
];
function renderScreening(wiz) {
  const m = wiz.model;
  let rows = "";
  SCREEN_Q.forEach(([k, q]) => {
    const y = m[k] === "yes" ? " checked" : "";
    const n = m[k] === "no" ? " checked" : "";
    rows += '<tr><td class="q">' + esc(q) + '</td>' +
      '<td class="yn"><input type="radio" name="wz_' + k + '" value="yes"' + y + '></td>' +
      '<td class="yn"><input type="radio" name="wz_' + k + '" value="no"' + n + '></td></tr>';
  });
  return '<p class="wz-lede">Answering “Yes” does not automatically disqualify you. These questions support safe placement and are discussed confidentially with the Safeguard Lead.</p>' +
    '<div class="table-wrap"><table><thead><tr><th>Question</th><th class="c">Yes</th><th class="c">No</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    textarea("ssExplain", "If you answered “Yes” to any question, please explain", m.ssExplain, { minHeight: 120 }) +
    '<p class="wz-note" id="wz-explain-note" style="display:none">An explanation is required because you answered “Yes” above.</p>';
}
function readScreening(wiz) {
  return {
    ss1: radio(wiz, "wz_ss1"), ss2: radio(wiz, "wz_ss2"), ss3: radio(wiz, "wz_ss3"),
    ss4: radio(wiz, "wz_ss4"), ss5: radio(wiz, "wz_ss5"),
    ssExplain: val(wiz, "ssExplain"),
  };
}

// References ----------------------------------------------------------------
function renderReferences(wiz) {
  const m = wiz.model;
  return '<p class="wz-lede">Provide two references (not relatives). At least one must be from outside your current church.</p>' +
    '<label style="display:flex;gap:10px;align-items:flex-start;background:#F2EFE8;border:1px solid #E4E0DA;border-radius:8px;padding:12px 14px;margin-bottom:16px;cursor:pointer;font-size:13.5px;line-height:1.45"><input type="checkbox" id="wz_referencesLater" style="margin-top:2px"' + (m.referencesLater ? " checked" : "") + '><span><b>Not sure who to list yet?</b> Check this to skip for now — you can add your references later from your dashboard.</span></label>' +
    '<div class="sub-title">Reference #1</div>' +
    field("r1Name", "Name", m.r1Name) +
    '<div class="row">' + field("r1Phone", "Phone", m.r1Phone, { type: "tel", optional: true }) + field("r1Email", "Email", m.r1Email, { type: "email" }) + '</div>' +
    '<div class="row">' + field("r1Rel", "Relationship", m.r1Rel) + field("r1Years", "Years known", m.r1Years, { optional: true }) + '</div>' +
    '<div class="sub-title">Reference #2</div>' +
    field("r2Name", "Name", m.r2Name) +
    '<div class="row">' + field("r2Phone", "Phone", m.r2Phone, { type: "tel", optional: true }) + field("r2Email", "Email", m.r2Email, { type: "email" }) + '</div>' +
    '<div class="row">' + field("r2Rel", "Relationship", m.r2Rel) + field("r2Years", "Years known", m.r2Years, { optional: true }) + '</div>';
}

// Youth detail --------------------------------------------------------------
function renderYouthDetail(wiz) {
  const m = wiz.model;
  return '<div class="youth-callout"><div class="ico">!</div><div>' +
      '<span class="who">Junior Volunteers</span>' +
      '<span class="head">A few extra questions for applicants under 16.</span>' +
      '<span class="sub">Your parent or guardian will also need to consent on the next step.</span></div></div>' +
    field("grade", "Grade", m.grade, { optional: true }) +
    field("parentName", "Parent/guardian name(s)", m.parentName) +
    field("parentPhone", "Parent/guardian phone", m.parentPhone, { type: "tel" }) +
    '<div class="prompt" style="margin-top:14px">Are your parents supportive of your ministry involvement?</div>' + yesNo("wz_parentsSupport", m.parentsSupport) +
    '<div class="sub-title">Faith & personal background</div>' +
    textarea("yFaith", "What does your faith in Jesus mean to you?", m.yFaith) +
    textarea("yWhy", "Why would you like to be part of our ministry team?", m.yWhy) +
    textarea("yGifts", "What strengths or gifts would you bring?", m.yGifts, { optional: true }) +
    textarea("yConcerns", "Do you have any concerns about working with children?", m.yConcerns, { optional: true }) +
    '<div class="sub-title">Volunteer experience</div>' +
    textarea("yExp", "List any volunteer experience, part-time jobs, or babysitting", m.yExp, { optional: true }) +
    '<div class="sub-title">Junior volunteer references</div>' +
    '<p class="wz-note">Two adults who know you well. At least one must be a pastor, teacher, or employer. One relative is allowed.</p>' +
    '<div class="sub-title" style="font-size:15px">Reference #1</div>' +
    field("yr1Name", "Name", m.yr1Name) +
    '<div class="row">' + field("yr1PE", "Phone / email", m.yr1PE) + field("yr1Rel", "Relationship", m.yr1Rel, { optional: true }) + '</div>' +
    '<div class="sub-title" style="font-size:15px">Reference #2</div>' +
    field("yr2Name", "Name", m.yr2Name) +
    '<div class="row">' + field("yr2PE", "Phone / email", m.yr2PE) + field("yr2Rel", "Relationship", m.yr2Rel, { optional: true }) + '</div>';
}
function readYouthDetail(wiz) {
  return {
    grade: val(wiz, "grade"), parentName: val(wiz, "parentName"), parentPhone: val(wiz, "parentPhone"),
    parentsSupport: radio(wiz, "wz_parentsSupport"),
    yFaith: val(wiz, "yFaith"), yWhy: val(wiz, "yWhy"), yGifts: val(wiz, "yGifts"), yConcerns: val(wiz, "yConcerns"),
    yExp: val(wiz, "yExp"),
    yr1Name: val(wiz, "yr1Name"), yr1PE: val(wiz, "yr1PE"), yr1Rel: val(wiz, "yr1Rel"),
    yr2Name: val(wiz, "yr2Name"), yr2PE: val(wiz, "yr2PE"), yr2Rel: val(wiz, "yr2Rel"),
  };
}

// Declarations (adult OR youth branch) --------------------------------------
function attest(id, checked, text) {
  return '<label class="attest"><input type="checkbox" id="wz_' + id + '"' + (checked ? " checked" : "") + '><span>' + text + '</span></label>';
}
function renderDeclarations(wiz) {
  const m = wiz.model;
  if (m.isAdult === false) return renderYouthDeclarations(wiz);
  return attest("dec1", m.dec1, "I certify that the information provided in this application is true and complete to the best of my knowledge.") +
    attest("dec2", m.dec2, "I authorize this church to contact the references listed above and to perform background screening as required by the Safeguard Framework.") +
    attest("dec3", m.dec3, "I understand that serving with children and youth is a position of trust and agree to abide by the policies of the Safeguard Framework.") +
    attest("dec4", m.dec4, "I understand that misrepresentation or omission of information on this form may result in removal from ministry.") +
    '<div class="row-sig" style="margin-top:18px">' +
      field("appSig", "Applicant — signature", m.appSig || m.fullName, { placeholder: "Type your full legal name as your signature" }) +
      field("appSigDate", "Date", m.appSigDate || todayIso(), { type: "date" }) +
    '</div>' +
    attest("appConsent", m.appConsent, "I intend my typed name above to serve as my legal signature on this application.");
}
function renderYouthDeclarations(wiz) {
  const m = wiz.model;
  return '<div class="sub-title" style="margin-top:0">Junior volunteer declaration</div>' +
    attest("yd1", m.yd1, "I affirm that the information above is true.") +
    attest("yd2", m.yd2, "I commit to serving under the Safeguard Framework and its core protection policies (SG-POL-001 through SG-POL-004).") +
    attest("yd3", m.yd3, "I understand that my ministry involvement will be supervised by two approved adults at all times.") +
    '<div class="row-sig" style="margin-top:14px">' +
      field("youthSig", "Junior volunteer — signature", m.youthSig || m.fullName) +
      field("youthSigDate", "Date", m.youthSigDate || todayIso(), { type: "date" }) +
    '</div>' +
    attest("youthConsent", m.youthConsent, "I intend my typed name above to serve as my signature on this declaration.") +
    '<div class="sub-title">Parent / guardian consent</div>' +
    attest("pc1", m.pc1, "I give permission for my child to serve as a Junior Volunteer under the Safeguard Framework. I understand they will be supervised by two approved adults at all times and agree to support their participation.") +
    '<div class="row-sig">' +
      field("pgSig", "Parent / guardian — signature", m.pgSig) +
      field("pgSigDate", "Date", m.pgSigDate || todayIso(), { type: "date" }) +
    '</div>' +
    attest("pgConsent", m.pgConsent, "I intend my typed name above to serve as my signature authorizing this consent.");
}
function readDeclarations(wiz) {
  if (wiz.model.isAdult === false) {
    return {
      yd1: chk(wiz, "yd1"), yd2: chk(wiz, "yd2"), yd3: chk(wiz, "yd3"),
      youthSig: val(wiz, "youthSig"), youthSigDate: val(wiz, "youthSigDate"), youthConsent: chk(wiz, "youthConsent"),
      pc1: chk(wiz, "pc1"),
      pgSig: val(wiz, "pgSig"), pgSigDate: val(wiz, "pgSigDate"), pgConsent: chk(wiz, "pgConsent"),
    };
  }
  return {
    dec1: chk(wiz, "dec1"), dec2: chk(wiz, "dec2"), dec3: chk(wiz, "dec3"), dec4: chk(wiz, "dec4"),
    appSig: val(wiz, "appSig"), appSigDate: val(wiz, "appSigDate"), appConsent: chk(wiz, "appConsent"),
  };
}

// Review --------------------------------------------------------------------
function renderReview(wiz) {
  const m = wiz.model;
  const youth = m.isAdult === false;
  const row = (label, value) => '<div class="rv-row"><span class="rv-k">' + esc(label) + '</span><span class="rv-v">' + (value ? esc(value) : '<em>—</em>') + '</span></div>';
  const ynLabel = v => v === "yes" ? "Yes" : (v === "no" ? "No" : "");

  const sec = (id, title, html) =>
    '<div class="rv-sec"><div class="rv-head"><span>' + esc(title) + '</span>' +
    '<button type="button" class="rv-edit" data-step="' + id + '">Edit</button></div>' + html + '</div>';

  let out = '<p class="wz-lede">Please look over your answers. You can edit any section before submitting.</p>';

  out += sec("personal", "About you",
    row("Full name", m.fullName) + row("Date of birth", m.dob) + row("Email", m.email) +
    row("Phone (cell)", m.phoneCell) + row("Phone (home)", m.phoneHome));
  out += sec("address", "Address",
    row("Street", m.address) + row("City", m.city) + row("Province", m.province) + row("Postal", m.postal));
  out += sec("emergency", "Emergency contact",
    row("Name", m.emergencyContact && m.emergencyContact.name) +
    row("Phone", m.emergencyContact && m.emergencyContact.phone) +
    row("Relationship", m.emergencyContact && m.emergencyContact.relationship));
  out += sec("spiritual", "Spiritual background",
    row("Attending since", m.attendLength) + row("2+ services/month", ynLabel(m.services)) +
    row("Member", ynLabel(m.member)) + row("Baptized", ynLabel(m.baptized)) + row("Journey", m.journey));
  const programLabels = (m.programs || [])
    .map(p => (PROGRAM_OPTIONS.find(o => o[0] === p) || [, p])[1]).join(", ");
  const areaLabels = (m.childrenAreas || [])
    .map(a => (CHILDREN_AREA_OPTIONS.find(o => o[0] === a) || [, a])[1]).join(", ");
  out += sec("preferences", "Serving preferences",
    row("Interested in serving with", programLabels) +
    (m.programs && m.programs.includes("sunday-children") ? row("Sunday Children's areas", areaLabels) : "") +
    row("Skills", m.skills));
  out += sec("screening", "Safety screening",
    row("Criminal offense", ynLabel(m.ss1)) + row("Child welfare investigation", ynLabel(m.ss2)) +
    row("Misconduct termination", ynLabel(m.ss3)) + row("Personal circumstances", ynLabel(m.ss4)) +
    row("Health concerns", ynLabel(m.ss5)) + row("Explanation", m.ssExplain));
  out += sec("references", "References",
    row("Ref 1", [m.r1Name, m.r1Email, m.r1Rel].filter(Boolean).join(" · ")) +
    row("Ref 2", [m.r2Name, m.r2Email, m.r2Rel].filter(Boolean).join(" · ")));
  if (youth) {
    out += sec("youth-detail", "Junior volunteer details",
      row("Parent/guardian", m.parentName) + row("Parent phone", m.parentPhone) +
      row("Parents supportive", ynLabel(m.parentsSupport)));
    out += sec("declarations", "Declarations & consent",
      row("Junior signature", m.youthSig) + row("Parent/guardian signature", m.pgSig));
  } else {
    out += sec("declarations", "Declaration & consent",
      row("Signature", m.appSig) + row("Date", m.appSigDate));
  }
  out += '<p class="wz-note" style="margin-top:18px">By submitting, your application goes to the Safeguard Coordinator and your Bethany Chapel record is updated.</p>';
  return out;
}

// Done ----------------------------------------------------------------------
function renderDone(wiz) {
  return '<div class="submitted-banner" style="display:flex">' +
      '<div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>' +
      '<div><b>Application submitted to the Safeguard Coordinator</b>' +
      '<span>Record ID: <code>' + esc(wiz.recordId) + '</code></span>' +
      '<span style="margin-top:6px">The coordinator will follow up about your references, police check, and next steps.</span></div>' +
    '</div>' +
    '<p class="wz-lede" style="margin-top:6px">Thanks for taking the time. Your profile is now complete — here\'s what comes next on your dashboard:</p>' +
    '<ul class="wz-next"><li>Sign the Worker\'s Covenant</li><li>Submit your Police Information Check</li><li>Complete the Safeguard training modules</li></ul>' +
    '<div class="actions" style="margin-top:8px">' +
      '<a class="btn btn-primary" href="dashboard.html">Go to my dashboard</a>' +
      '<a class="btn btn-secondary" href="SG-FRM-001.html">Print a copy</a>' +
    '</div>';
}

// ── Dynamic wiring (conditional UI inside a step) ───────────
function wireDynamic(wiz, step) {
  if (step.id === "preferences") {
    const areas = wiz.host.querySelector("#wz-children-areas");
    wiz.host.querySelectorAll('input[name="wz_program"]').forEach(el => {
      el.addEventListener("change", () => {
        const sundayOn = !!wiz.host.querySelector('input[name="wz_program"][value="sunday-children"]:checked');
        if (areas) areas.style.display = sundayOn ? "block" : "none";
      });
    });
  }
  if (step.id === "screening") {
    const note = wiz.host.querySelector("#wz-explain-note");
    const sync = () => {
      const anyYes = SCREEN_Q.some(([k]) => radio(wiz, "wz_" + k) === "yes");
      if (note) note.style.display = anyYes && !val(wiz, "ssExplain") ? "block" : "none";
    };
    wiz.host.querySelectorAll('input[type="radio"], #wz_ssExplain').forEach(el => {
      el.addEventListener("change", sync); el.addEventListener("input", sync);
    });
  }
  if (step.id === "review") {
    wiz.host.querySelectorAll(".rv-edit").forEach(btn => {
      btn.addEventListener("click", () => wiz.goToStepId(btn.getAttribute("data-step")));
    });
  }
}

// ── Navigation ──────────────────────────────────────────────
function commitCurrent(wiz) {
  const step = wiz.currentStep();
  const slice = step.read() || {};
  Object.assign(wiz.model, slice);
  // Keep fullName ↔ first/last loosely in sync for the profile write.
  if (slice.fullName !== undefined) {
    const parts = (slice.fullName || "").trim().split(/\s+/);
    if (parts.length) {
      wiz.model.firstName = parts[0] || wiz.model.firstName;
      wiz.model.lastName = parts.slice(1).join(" ") || wiz.model.lastName;
    }
  }
  // Recompute adult/youth if DOB changed and the welcome answer is absent.
  if (slice.dob !== undefined && wiz.model.isAdult == null) {
    const age = ageFromDob(slice.dob);
    if (age != null) wiz.model.isAdult = age >= 16;
  }
}

function goNext(wiz) {
  commitCurrent(wiz);
  const step = wiz.currentStep();
  const errors = step.validate(wiz.model) || [];
  if (errors.length) {
    wiz.onMessage("Please complete: " + errors.join(", "), "err");
    return;
  }
  persist(wiz, false);   // autosave slice, profileComplete stays false
  wiz.index += 1;
  renderCurrent(wiz);
}

function goBack(wiz) {
  commitCurrent(wiz);    // save without validating
  persist(wiz, false);
  wiz.index = Math.max(0, wiz.index - 1);
  renderCurrent(wiz);
}

function goToStepId(wiz, id) {
  commitCurrent(wiz);
  const active = wiz.activeSteps();
  const i = active.findIndex(s => s.id === id);
  if (i >= 0) { wiz.index = i; renderCurrent(wiz); }
}

function saveLater(wiz) {
  commitCurrent(wiz);
  persist(wiz, false)
    .then(() => wiz.onMessage("Saved. You can finish any time — we'll pick up right here.", "ok"))
    .catch(err => wiz.onMessage("Couldn't save. " + (err && err.message ? err.message : "Please try again."), "err"));
}

// ── Persistence ─────────────────────────────────────────────
// Builds the application snapshot from the model and writes the
// profile slice. `complete` flips profileComplete on final submit.
function profilePayload(wiz, complete, extra) {
  const m = wiz.model;
  const payload = {
    firstName: m.firstName || "",
    lastName: m.lastName || "",
    preferredName: m.preferredName || "",
    dob: m.dob || "",
    phone: m.phoneCell || "",
    address: { street: m.address || "", city: m.city || "", province: m.province || "", postal: m.postal || "" },
    emergencyContact: {
      name: (m.emergencyContact && m.emergencyContact.name) || "",
      phone: (m.emergencyContact && m.emergencyContact.phone) || "",
      relationship: (m.emergencyContact && m.emergencyContact.relationship) || "",
    },
    programs: Array.isArray(m.programs) ? m.programs : [],
    childrenAreas: Array.isArray(m.childrenAreas) ? m.childrenAreas : [],
    ageGroups: gatherAgeGroups(m),
    serviceTimes: gatherServiceTimes(m),
    testimony: m.testimony || "",
    attendingSince: m.attendingSince || "",
    profileComplete: !!complete,
  };
  // The profile stores only the application MARKER. Firestore rules require
  // `application` to be EXACTLY { submittedAt, recordId, isYouth }; the full
  // application data lives in the People submission, not the profile. Only the
  // final submit supplies these, so autosave never writes `application`.
  if (extra && extra.submittedAt) {
    payload.application = {
      submittedAt: extra.submittedAt,
      recordId: extra.recordId || "",
      isYouth: !!extra.isYouth,
    };
  }
  return payload;
}

function persist(wiz, complete, extra) {
  // Autosave path: never mark complete; never block the UI on errors.
  return saveProfile(profilePayload(wiz, complete, extra)).catch(err => {
    // Surface only on explicit save; autosave stays quiet.
    if (complete) throw err;
    return null;
  });
}

// ── Final submit ────────────────────────────────────────────
async function submit(wiz) {
  // Defense in depth: re-validate every active step before submitting.
  commitCurrent(wiz);
  const active = wiz.activeSteps();
  for (const st of active) {
    if (st.id === "review" || st.id === "done") continue;
    const errs = st.validate(wiz.model) || [];
    if (errs.length) {
      const i = active.findIndex(s => s.id === st.id);
      wiz.index = i;
      renderCurrent(wiz);
      wiz.onMessage("Please complete: " + errs.join(", "), "err");
      return false;
    }
  }

  wiz.onNavState({ submitting: true });
  wiz.onMessage("", "");

  try {
    const recordId = generateRecordId();
    const submittedAt = new Date().toISOString();
    wiz.recordId = recordId;

    // 1. Profile + application snapshot (profileComplete:true).
    await saveProfile(profilePayload(wiz, true, {
      submittedAt, recordId, isYouth: isYouth(wiz.model),
    }));

    // 2. References (adult section 6 → the canonical references shape).
    await saveReferences(wiz.model.referencesLater ? [] : [
      { name: wiz.model.r1Name, email: wiz.model.r1Email, relationship: wiz.model.r1Rel },
      { name: wiz.model.r2Name, email: wiz.model.r2Email, relationship: wiz.model.r2Rel },
    ]);

    // 3. People submission row — same contract as SG-FRM-001.
    const rowData = buildRowData(wiz.model, recordId, submittedAt);
    await createSubmission({ tabName: "People", rowData, recordId });

    // 4. Advance to the terminal "done" step.
    wiz.submitted = true;
    const all = wiz.activeSteps();
    wiz.index = all.findIndex(s => s.id === "done");
    if (wiz.index < 0) wiz.index = all.length - 1;
    renderCurrent(wiz);
    return true;
  } catch (err) {
    wiz.onNavState({ submitting: false });
    wiz.onMessage("Couldn't submit. " + (err && err.message ? err.message : "Please try again."), "err");
    return false;
  }
}

// ── Small DOM helpers ───────────────────────────────────────
function val(wiz, id) { const el = wiz.host.querySelector("#wz_" + id); return el ? (el.value || "").trim() : ""; }
function chk(wiz, id) { const el = wiz.host.querySelector("#wz_" + id); return !!(el && el.checked); }
function radio(wiz, name) { const el = wiz.host.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; }
function readFields(wiz, ids) { const o = {}; ids.forEach(id => { o[id] = val(wiz, id); }); return o; }
