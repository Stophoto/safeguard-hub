# Redesign Rollout — Shared Agent Brief

You are one of several agents rolling out a site-wide visual redesign of the
**Bethany Chapel Safeguard Hub**. Read this brief, then do ONLY the files in
your assignment. Other agents own the other files — stay in your lane.

## What this project is
A **static multi-page website**: plain HTML pages + vanilla JS (`sg-*.js`) +
Firebase. **It is NOT React.** The design reference prototype uses an in-house
`dc-runtime` (`support.js`, `<sc-if>`, `{{ }}`) — that is mockup tooling only.
**Do not port the runtime.** Treat the reference as an exact spec of look, markup,
copy, and spacing.

## The design
Replace the warm cream/gold/serif look with a clean navy + bright-blue system on
a cool light-gray canvas, flat white cards, Archivo headings + IBM Plex Sans body.

**Read these before editing (they are the source of truth):**
1. `sg-redesign.css` (repo root) — the authored design system: tokens (`--sg-*`)
   and the component kit (`.sg-card`, `.sg-btn`, `.sg-badge`, `.sg-input`,
   `.sg-stat`, `.sg-stepper`, `.sg-banner`, `.sg-doctag`, `.sg-divider`,
   `.sg-h1`, `.sg-eyebrow`, etc.) + 860/460 responsive helpers.
   **Consume it. Do NOT edit it.** If you hit a real gap, add a small page-local
   `<style>` and note it in your report — never modify the shared stylesheet.
2. The visual spec (exact tokens, per-screen layout, responsive rules):
   `/root/.claude/uploads/2bf7f62b-70f3-590a-8f45-c74732bfd87c/ba9ed1f6-README.md`
3. Exact markup/inline-style reference for the 6 hero screens:
   `/root/.claude/uploads/2bf7f62b-70f3-590a-8f45-c74732bfd87c/e2cb1c76-Bethany_Safeguard.dc.html`
   (The fixed "SCREENS" pill in the prototype is review-only — do not build it.)

## Per-page transformation (apply to every HTML file you own)
1. **Fonts:** in `<head>`, replace the DM Serif/DM Sans Google Fonts `<link>` with
   `https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap`.
   Drop the old `integrity` hash (it won't match the new URL); keep
   `rel="stylesheet"` + `crossorigin="anonymous"`. The CSP already allows
   `fonts.googleapis.com` + `fonts.gstatic.com` — do not weaken the CSP meta.
2. **Stylesheet:** add `<link rel="stylesheet" href="sg-redesign.css">` after the
   fonts link and before the page's own `<style>`.
3. **Body:** add `class="sg-redesign"` to `<body>` (KEEP existing classes and
   attributes — `data-church`, `data-doc-code`, etc.).
4. **Tokens:** remove the page's old `:root` cream/gold/serif variables (or
   repoint them to the new `--sg-*` tokens). Update the page's own `<style>` rules
   to the new palette/type. No cream backgrounds, no gold accents, no serif heads.
5. **Recreate the look** using the kit: white `.sg-card` surfaces on the canvas,
   Archivo headings, IBM Plex body, blue uppercase eyebrows, `.sg-divider`
   section rules, `.sg-btn` buttons, `.sg-input`/`.sg-label` fields, badges,
   stat tiles, status banners, etc. Match the spec's spacing/radii/shadows.
6. **Responsive:** must reflow cleanly at 860px and 460px. Any data **table must
   become one-card-per-row on phones** (never a 5-col table at 390px). 44px min
   tap targets. Test mentally at 390px.

## MUST PRESERVE (do not break the working app)
- Every element **id**, form field **name/id**, `data-*` attribute, and JS hook
  (`onclick`, etc.). The `sg-*.js` scripts find elements by these.
- Every `<script>` include and its **order** (`sg-nav.js`, `sg-auth.js`,
  `sg-firebase.js`, `sg-application.js`, `sg-wizard.js`, …). Do not remove them.
- The **CSP `<meta>`**, Firebase wiring, form `action`s, hidden inputs.
- **All copy/text** — restyle, do not reword. Keep document codes.
- **Print fidelity:** cover letters, SOP cards, signs, room-full-sign and the
  forms must still print correctly. Keep `@media print` rules and page-break
  behavior working; the redesign is for screen.
- Accessibility: labels tied to inputs, alt text, focus states.

## Output — IMPORTANT: do NOT run git
You are working in a **shared working tree** alongside other agents editing
different files. Running git would corrupt their in-progress work.
- **Do NOT run any git command that writes:** no `git add`, `commit`, `push`,
  `checkout`, `reset`, `restore`, `stash`, `rm`, `mv`, or branch ops. Read-only
  inspection (`git status`, `git diff` on your own files) is fine.
- Just **edit your assigned files in place** and leave them modified. The
  orchestrator stages, commits, and pushes each lane centrally.
- Final reply: the list of files you changed, anything you could not complete,
  and any gaps you found in `sg-redesign.css`.
