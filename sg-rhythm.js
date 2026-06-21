// sg-rhythm.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// The Safeguard Coordinator's recurring rhythm: a small set of
// repeating tasks, plus a memory of when each was last done so the
// Admin Dashboard can flag what's due or overdue.
//
// The whole rhythm state lives in ONE Firestore doc — /adminRhythm/current —
// keyed by task key. Coordinator-only (enforced by firestore.rules).
// ─────────────────────────────────────────────────────────────

import {
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db } from "./sg-firebase.js";

// ── The recurring tasks, grouped by cadence ─────────────────
// `intervalDays` drives the due/overdue math; `href` is the governing doc.
export const RHYTHM_TASKS = [
  // Weekly
  { key: "weekly-two-adult", cadence: "weekly", intervalDays: 7,
    label: "Two-adult rule held in every room", href: "SG-POL-002.html" },
  { key: "weekly-ratio", cadence: "weekly", intervalDays: 7,
    label: "Rooms within ratio / capacity", href: "SG-SOP-003.html" },
  { key: "weekly-tags", cadence: "weekly", intervalDays: 7,
    label: "Sign-in & pickup tags running", href: "SG-SOP-005.html" },
  // Monthly
  { key: "monthly-walkthrough", cadence: "monthly", intervalDays: 30,
    label: "Unannounced walkthrough of all ministry spaces", href: "SG-T-103.html" },
  { key: "monthly-roster", cadence: "monthly", intervalDays: 30,
    label: "Tidy the roster — pause anyone who has stopped serving", href: "admin.html" },
  // Quarterly
  { key: "quarterly-audit", cadence: "quarterly", intervalDays: 90,
    label: "Training & clearance audit (everyone serving is trained and cleared)", href: "SG-G-001.html" },
  { key: "quarterly-emergency", cadence: "quarterly", intervalDays: 90,
    label: "Refresh children's emergency / medical info", href: "SG-FRM-005.html" },
  // Yearly
  { key: "yearly-compliance", cadence: "yearly", intervalDays: 365,
    label: "Full compliance audit", href: "SG-G-001.html" },
  { key: "yearly-police", cadence: "yearly", intervalDays: 365,
    label: "Police-check renewal cycle (3-year checks)", href: "SG-FRM-003.html" },
  { key: "yearly-policy", cadence: "yearly", intervalDays: 365,
    label: "Policy review — keep all policies current", href: "SG-G-001.html" },
  { key: "yearly-board", cadence: "yearly", intervalDays: 365,
    label: "Report to the Board of Elders", href: "SG-G-001.html" },
];

export const CADENCE_LABELS = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };

const RHYTHM_REF = () => doc(db, "adminRhythm", "current");

// ── Read the whole rhythm memory ────────────────────────────
// Returns a map: { [taskKey]: { lastDoneAt, lastDoneBy } }.
export async function loadRhythm() {
  try {
    const snap = await getDoc(RHYTHM_REF());
    return (snap.exists() && snap.data().tasks) || {};
  } catch (_) {
    return {};
  }
}

// ── Stamp a task as done now ────────────────────────────────
// Deep-merges so other tasks in the doc are untouched.
export async function markRhythmDone(key) {
  const uid = auth.currentUser ? auth.currentUser.uid : null;
  const patch = { tasks: {}, updatedAt: serverTimestamp() };
  patch.tasks[key] = { lastDoneAt: new Date().toISOString(), lastDoneBy: uid };
  await setDoc(RHYTHM_REF(), patch, { merge: true });
  return patch.tasks[key];
}

// ── Compute a task's due state from its memory entry ────────
// Never done → "overdue" (reads as "due now"). Within the last ~20% of
// the interval → "due-soon". Otherwise "ok".
export function rhythmStatus(task, entry) {
  const lastDoneAt = entry && entry.lastDoneAt ? entry.lastDoneAt : null;
  if (!lastDoneAt) return { lastDoneAt: null, dueState: "overdue" };
  const days = (Date.now() - new Date(lastDoneAt).getTime()) / (1000 * 60 * 60 * 24);
  let dueState = "ok";
  if (days > task.intervalDays) dueState = "overdue";
  else if (days > task.intervalDays * 0.8) dueState = "due-soon";
  return { lastDoneAt, dueState };
}
