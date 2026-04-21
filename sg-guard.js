// sg-guard.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// One-call auth gate for content pages that don't otherwise talk
// to Firebase (policies, SOPs, training modules, printable forms).
//
// Pages that already run their own onUserChange gate (dashboard,
// admin, fillable forms, etc.) don't need this — they handle auth
// themselves and also load Firestore data that's protected by
// firestore.rules on the server.
//
// Usage: paired with an inline <style> that hides the body until
// the gate resolves. The two tags go at the very top of <body>,
// e.g.
//
//   <body data-doc-code="SG-POL-001" ...>
//   <style id="sg-guard-style">body{visibility:hidden}</style>
//   <script type="module">
//     import { requireAuth } from "./sg-guard.js";
//     requireAuth();
//   </script>
//
// Behavior:
//   • Not signed in → redirect to sign-in.html?next=<this-page>.
//   • Signed in but email not verified → redirect to verify-email.html.
//   • Signed in + verified → remove the hiding style, reveal body.
// ─────────────────────────────────────────────────────────────

import { onUserChange } from "./sg-auth.js";

function reveal() {
  const hideStyle = document.getElementById("sg-guard-style");
  if (hideStyle) hideStyle.remove();
}

function currentPageHref() {
  // Just the filename + query + hash — relative, so the sign-in
  // redirect doesn't care which host or subdirectory we're on.
  const file = location.pathname.split("/").pop() || "index.html";
  return file + location.search + location.hash;
}

export function requireAuth() {
  onUserChange(user => {
    if (!user) {
      location.replace("sign-in.html?next=" + encodeURIComponent(currentPageHref()));
      return;
    }
    if (!user.emailVerified) {
      location.replace("verify-email.html");
      return;
    }
    reveal();
  });
}
