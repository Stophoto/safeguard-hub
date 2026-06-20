// ── Quiz-gated module completion ─────────────────────────────
// A training module is "complete" ONLY when its end-of-module quiz is
// passed (80%+). There is no self-attestation. Each module page reveals
// #complete-section when scoreQuiz() passes; this script watches for that
// and writes the completion to the volunteer's training record.
import { markTrainingComplete } from "./sg-profile.js";

const slug = (location.pathname.split("/").pop() || "").replace(/\.html$/i, "");
const MODULE_CODE = /^SG-T-\d+$/i.test(slug) ? slug.toUpperCase() : null;

const section = document.getElementById("complete-section");

if (MODULE_CODE && section) {
  // Remove the old manual "Mark Module as Complete" button — passing the
  // quiz is the only way to complete, so there's nothing to click.
  const btn = document.getElementById("complete-btn");
  if (btn) btn.style.display = "none";
  const confirm = document.getElementById("complete-confirm");

  let saved = false;

  async function persist() {
    if (saved) return;
    saved = true;
    try {
      await markTrainingComplete(MODULE_CODE);
      // Reveal the page's own confirmation message (kept as authored, so
      // module-specific notes like the covenant link still show).
      if (confirm) confirm.classList.add("visible");
    } catch (err) {
      saved = false; // allow another attempt if the quiz is re-passed
      if (confirm) {
        confirm.textContent =
          "You passed, but we couldn't update your record (" +
          (err.message || "network error") +
          "). Refresh and re-submit the quiz to try again.";
        confirm.classList.add("visible");
      }
    }
  }

  const isVisible = () =>
    section.style.display !== "none" &&
    getComputedStyle(section).display !== "none";

  if (isVisible()) persist();
  const obs = new MutationObserver(() => { if (isVisible()) persist(); });
  obs.observe(section, { attributes: true, attributeFilter: ["style", "class"] });
}
