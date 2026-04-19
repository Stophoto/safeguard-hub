// sg-user-chip.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// Reusable user chip + dropdown menu. The chip lives in the
// top navy header of every signed-in page (next to the main
// nav links). Clicking it opens a Google-style account menu
// with: My dashboard · Edit profile · Account settings · Sign out.
//
// Usage from any page:
//   <div id="userChip"></div>
//   <script type="module">
//     import { mountUserChip } from "./sg-user-chip.js";
//     mountUserChip(document.getElementById("userChip"));
//   </script>
//
// The function is idempotent — calling it twice on the same
// container won't duplicate elements. It subscribes to auth
// state and re-renders when the user signs in or out.
// ─────────────────────────────────────────────────────────────

import { onUserChange, signOutUser } from "./sg-auth.js";
import { getOrCreateProfile, displayName } from "./sg-profile.js";

// ── Inject shared styles once ───────────────────────────────
function injectStylesOnce() {
  if (document.getElementById("sg-user-chip-styles")) return;
  const style = document.createElement("style");
  style.id = "sg-user-chip-styles";
  style.textContent = `
    .sg-uc-wrap { position: relative; display: inline-flex; }

    .sg-uc-chip {
      background: rgba(255,255,255,0.08);
      color: #fff;
      padding: 5px 14px 5px 5px;
      border-radius: 22px;
      font-size: 12px;
      font-weight: 500;
      display: flex;
      gap: 10px;
      align-items: center;
      cursor: pointer;
      border: 1px solid rgba(255,255,255,0.12);
      transition: all 0.15s;
      font-family: 'DM Sans', sans-serif;
    }
    .sg-uc-chip:hover,
    .sg-uc-chip[aria-expanded="true"] {
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.24);
    }
    .sg-uc-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #B09055 0%, #C4A46A 100%);
      color: #0F2530;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'DM Serif Display', serif;
      font-size: 14px;
      font-weight: 400;
      flex-shrink: 0;
    }
    .sg-uc-stack {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.1;
    }
    .sg-uc-name { font-weight: 600; color: #fff; }
    .sg-uc-role {
      color: #C4A46A;
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .sg-uc-caret {
      width: 8px;
      height: 8px;
      border-right: 1.5px solid rgba(255,255,255,0.5);
      border-bottom: 1.5px solid rgba(255,255,255,0.5);
      transform: rotate(45deg);
      margin: -3px 2px 0 -2px;
    }

    /* Collapse name/role on small screens — show only avatar */
    @media (max-width: 640px) {
      .sg-uc-stack, .sg-uc-caret { display: none; }
      .sg-uc-chip { padding: 3px; border-radius: 50%; }
    }

    /* Dropdown panel */
    .sg-uc-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: #fff;
      border: 1px solid #E4E0DA;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08);
      min-width: 280px;
      padding: 18px;
      z-index: 10001;
      opacity: 0;
      transform: translateY(-6px);
      pointer-events: none;
      transition: opacity 0.15s, transform 0.15s;
      font-family: 'DM Sans', sans-serif;
    }
    .sg-uc-menu.open {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    .sg-uc-menu-head {
      text-align: center;
      padding: 6px 0 16px;
      border-bottom: 1px solid #E4E0DA;
      margin-bottom: 14px;
    }
    .sg-uc-avatar-lg {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #B09055 0%, #C4A46A 100%);
      color: #0F2530;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'DM Serif Display', serif;
      font-size: 24px;
      margin: 0 auto 10px;
    }
    .sg-uc-menu-name {
      font-family: 'DM Serif Display', serif;
      font-size: 18px;
      color: #1B3A4B;
      word-break: break-word;
    }
    .sg-uc-menu-email {
      font-size: 12px;
      color: #8A8480;
      margin-top: 2px;
      word-break: break-all;
    }
    .sg-uc-menu-role {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #B09055;
      background: rgba(176,144,85,0.12);
      padding: 3px 9px;
      border-radius: 12px;
      margin-top: 8px;
    }

    .sg-uc-menu-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 12px;
      background: none;
      border: none;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 500;
      color: #3D3835;
      text-align: left;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
      text-decoration: none;
    }
    .sg-uc-menu-btn:hover {
      background: #F2EFE8;
      color: #1B3A4B;
    }
    .sg-uc-menu-btn svg {
      width: 16px;
      height: 16px;
      opacity: 0.6;
      flex-shrink: 0;
    }
    .sg-uc-menu-btn.disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .sg-uc-menu-btn.disabled:hover {
      background: none;
      color: #3D3835;
    }
    .sg-uc-menu-btn.danger { color: #C0392B; }
    .sg-uc-menu-btn.danger:hover { background: rgba(192,57,43,0.06); }

    .sg-uc-menu-divider {
      height: 1px;
      background: #E4E0DA;
      margin: 8px 0;
    }
  `;
  document.head.appendChild(style);
}

// ── Icon SVGs ───────────────────────────────────────────────
const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  signOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

// ── Role → label ────────────────────────────────────────────
function roleLabel(profile) {
  if (!profile) return "";
  switch (profile.role) {
    case "coordinator": return "Coordinator";
    case "leader":      return "Leader";
    case "volunteer":   return profile.profileComplete ? "Volunteer" : "In-process";
    default:            return "";
  }
}

// ── Build DOM ───────────────────────────────────────────────
function build(container) {
  container.innerHTML = `
    <div class="sg-uc-wrap">
      <button class="sg-uc-chip" type="button" aria-haspopup="true" aria-expanded="false">
        <span class="sg-uc-avatar" data-sg-avatar>?</span>
        <span class="sg-uc-stack">
          <span class="sg-uc-name" data-sg-name>—</span>
          <span class="sg-uc-role" data-sg-role>—</span>
        </span>
        <span class="sg-uc-caret"></span>
      </button>
      <div class="sg-uc-menu" role="menu">
        <div class="sg-uc-menu-head">
          <div class="sg-uc-avatar-lg" data-sg-avatar-lg>?</div>
          <div class="sg-uc-menu-name" data-sg-menu-name>—</div>
          <div class="sg-uc-menu-email" data-sg-menu-email>—</div>
          <div class="sg-uc-menu-role" data-sg-menu-role>—</div>
        </div>
        <a class="sg-uc-menu-btn" href="dashboard.html" role="menuitem">
          ${ICONS.dashboard}<span>My dashboard</span>
        </a>
        <a class="sg-uc-menu-btn" href="profile-setup.html" role="menuitem">
          ${ICONS.profile}<span>Edit profile</span>
        </a>
        <button class="sg-uc-menu-btn disabled" type="button" role="menuitem" aria-disabled="true" tabindex="-1">
          ${ICONS.settings}<span>Account settings</span>
        </button>
        <div class="sg-uc-menu-divider"></div>
        <button class="sg-uc-menu-btn danger" type="button" data-sg-signout role="menuitem">
          ${ICONS.signOut}<span>Sign out</span>
        </button>
      </div>
    </div>
  `;
}

// ── Update chip + menu with a profile ───────────────────────
function renderProfile(container, user, profile) {
  const emailFull = (profile && profile.email) || user.email || "";
  const firstName = (profile && (profile.preferredName || profile.firstName)) || (emailFull ? emailFull.split("@")[0] : "");
  const fullName = [profile && profile.firstName, profile && profile.lastName].filter(Boolean).join(" ") || firstName;
  const initial = (firstName || "?").slice(0, 1).toUpperCase();
  const role = roleLabel(profile);

  container.querySelector("[data-sg-avatar]").textContent = initial;
  container.querySelector("[data-sg-avatar-lg]").textContent = initial;
  container.querySelector("[data-sg-name]").textContent = firstName;
  container.querySelector("[data-sg-role]").textContent = role;
  container.querySelector("[data-sg-menu-name]").textContent = fullName;
  container.querySelector("[data-sg-menu-email]").textContent = emailFull;
  container.querySelector("[data-sg-menu-role]").textContent = role;
}

// ── Mount the chip into a container ─────────────────────────
export function mountUserChip(container) {
  if (!container) return;
  if (container.__sgChipMounted) return;
  container.__sgChipMounted = true;

  injectStylesOnce();
  build(container);

  const chipBtn = container.querySelector(".sg-uc-chip");
  const menu    = container.querySelector(".sg-uc-menu");
  const signoutBtn = container.querySelector("[data-sg-signout]");

  // ── Open / close behavior ─────────────────────────────
  let open = false;
  function setOpen(next) {
    open = !!next;
    menu.classList.toggle("open", open);
    chipBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  chipBtn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(!open); });
  // Close when any menu item (except disabled) is clicked
  menu.querySelectorAll(".sg-uc-menu-btn:not(.disabled)").forEach(btn => {
    btn.addEventListener("click", () => setOpen(false));
  });
  // Click outside → close
  document.addEventListener("click", (e) => {
    if (!open) return;
    if (container.contains(e.target)) return;
    setOpen(false);
  });
  // Escape → close
  document.addEventListener("keydown", (e) => {
    if (open && e.key === "Escape") { setOpen(false); chipBtn.focus(); }
  });

  // ── Sign out handler ─────────────────────────────────
  signoutBtn.addEventListener("click", async () => {
    signoutBtn.disabled = true;
    try { await signOutUser(); } catch (_) {}
    location.replace("sign-in.html");
  });

  // ── Auth state ────────────────────────────────────────
  // When the user resolves, hydrate the chip with their profile.
  // If no user, hide the whole container (page-level gates
  // already redirect anonymous visitors elsewhere).
  onUserChange(async (user) => {
    if (!user) {
      container.style.display = "none";
      return;
    }
    container.style.display = "";
    try {
      const profile = await getOrCreateProfile();
      renderProfile(container, user, profile);
    } catch (err) {
      console.warn("sg-user-chip: couldn't load profile", err);
      // Still show the chip with auth-level data as fallback
      renderProfile(container, user, null);
    }
  });
}
