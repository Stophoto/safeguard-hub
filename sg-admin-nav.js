// sg-admin-nav.js — Safeguard Hub
// ─────────────────────────────────────────────────────────────
// On phone-width viewports, collapses the top-nav links in the
// admin/dashboard header (elements with class .nav-link inside
// .hdr-inner) into a single "Menu" dropdown. Desktop layout is
// untouched.
//
// Pages that have two or more .nav-link items opt in by loading
// this script:
//
//   <script src="sg-admin-nav.js"></script>
//
// No module imports — pure DOM/CSS. Runs once on DOMContentLoaded.
// Safe on pages with 0 or 1 links (skips silently).
// ─────────────────────────────────────────────────────────────
(function () {
  'use strict';

  function init() {
    const hdrInner = document.querySelector('.hdr .hdr-inner') || document.querySelector('.hdr-inner');
    if (!hdrInner) return;

    const links = Array.from(hdrInner.querySelectorAll(':scope > .nav-link'));
    if (links.length < 2) return;

    // Styles — injected once, scoped by class prefix to avoid collisions.
    const STYLE_ID = 'sg-admin-nav-styles';
    if (!document.getElementById(STYLE_ID)) {
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = [
        '.sg-anv-wrap { position: relative; display: none; }',
        '.sg-anv-btn {',
        '  background: rgba(255,255,255,0.08);',
        '  color: rgba(255,255,255,0.9);',
        '  border: 1px solid rgba(255,255,255,0.18);',
        '  border-radius: 8px;',
        "  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;",
        '  font-size: 13px; font-weight: 600;',
        '  padding: 6px 12px;',
        '  display: inline-flex; align-items: center; gap: 8px;',
        '  cursor: pointer;',
        '  transition: background 0.15s, border-color 0.15s, color 0.15s;',
        '}',
        '.sg-anv-btn:hover, .sg-anv-btn[aria-expanded="true"] {',
        '  background: rgba(255,255,255,0.16);',
        '  border-color: rgba(255,255,255,0.28);',
        '  color: #fff;',
        '}',
        '.sg-anv-caret {',
        '  width: 7px; height: 7px;',
        '  border-right: 1.5px solid rgba(255,255,255,0.7);',
        '  border-bottom: 1.5px solid rgba(255,255,255,0.7);',
        '  transform: rotate(45deg);',
        '  margin: -3px 0 0 2px;',
        '}',
        '.sg-anv-menu {',
        '  position: fixed;',
        '  top: 0; right: 8px; left: auto;',
        '  background: #fff;',
        '  border: 1px solid #E4E0DA;',
        '  border-radius: 12px;',
        '  box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08);',
        '  min-width: 240px;',
        '  max-width: calc(100vw - 16px);',
        '  padding: 8px;',
        '  z-index: 10001;',
        '  opacity: 0;',
        '  transform: translateY(-6px);',
        '  pointer-events: none;',
        '  transition: opacity 0.15s, transform 0.15s;',
        "  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;",
        '}',
        '.sg-anv-menu.open {',
        '  opacity: 1; transform: translateY(0); pointer-events: auto;',
        '}',
        '.sg-anv-item {',
        '  display: block;',
        '  padding: 10px 14px;',
        '  font-size: 14px; font-weight: 500;',
        '  color: #3D3835;',
        '  text-decoration: none;',
        '  border-radius: 8px;',
        '  transition: background 0.15s, color 0.15s;',
        '}',
        '.sg-anv-item:hover { background: #F2EFE8; color: #1B3A4B; }',
        '.sg-anv-item.active {',
        '  background: #F2EFE8; color: #1B3A4B; font-weight: 700;',
        '}',
        // Only collapse the nav on phone widths. Desktop keeps its
        // existing layout with all links visible.
        '@media (max-width: 760px) {',
        '  .sg-anv-wrap { display: inline-flex; }',
        '  .hdr .hdr-inner > .nav-link { display: none; }',
        '  .hdr-inner:not(.hdr .hdr-inner) > .nav-link { display: none; }',
        '}'
      ].join('\n');
      document.head.appendChild(s);
    }

    // Build dropdown DOM
    const wrap = document.createElement('div');
    wrap.className = 'sg-anv-wrap';
    wrap.innerHTML =
      '<button type="button" class="sg-anv-btn" aria-haspopup="true" aria-expanded="false">'
      + 'Menu<span class="sg-anv-caret"></span>'
      + '</button>'
      + '<div class="sg-anv-menu" role="menu"></div>';
    const btn  = wrap.querySelector('.sg-anv-btn');
    const menu = wrap.querySelector('.sg-anv-menu');

    links.forEach(a => {
      const item = document.createElement('a');
      item.className = 'sg-anv-item' + (a.classList.contains('active') ? ' active' : '');
      item.href = a.getAttribute('href');
      // Normalize whitespace, strip ← characters that pages use for back-links.
      item.textContent = a.textContent.replace(/\s+/g, ' ').trim();
      item.setAttribute('role', 'menuitem');
      menu.appendChild(item);
    });

    // Insert the dropdown right before the userChip (or at the end if no chip).
    const chip = hdrInner.querySelector('#userChip');
    if (chip) hdrInner.insertBefore(wrap, chip);
    else     hdrInner.appendChild(wrap);

    // ── Open/close + positioning ──────────────────────────
    // Position the menu directly below the button, pinned to the viewport
    // right so it always lands on-screen regardless of where the button
    // sits after flex-wrap.
    let open = false;
    function positionMenu() {
      const rect = btn.getBoundingClientRect();
      menu.style.top = (rect.bottom + 6) + 'px';
      menu.style.right = '8px';
      menu.style.left  = 'auto';
      // Cap height so the menu never runs past the bottom of the screen.
      const roomBelow = window.innerHeight - rect.bottom - 16;
      menu.style.maxHeight = Math.max(200, roomBelow) + 'px';
      menu.style.overflowY = 'auto';
    }
    function setOpen(v) {
      open = !!v;
      if (open) positionMenu();
      menu.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', e => { e.stopPropagation(); setOpen(!open); });
    document.addEventListener('click', e => {
      if (!open) return;
      if (wrap.contains(e.target)) return;
      setOpen(false);
    });
    document.addEventListener('keydown', e => {
      if (open && e.key === 'Escape') { setOpen(false); btn.focus(); }
    });
    window.addEventListener('resize', () => { if (open) positionMenu(); });
    window.addEventListener('orientationchange', () => { if (open) positionMenu(); });
    menu.querySelectorAll('.sg-anv-item').forEach(i => {
      i.addEventListener('click', () => setOpen(false));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
