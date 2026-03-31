/**
 * sg-nav.js — Shared Navigation for Safeguard Framework Document Pages
 * Loaded via <script src="sg-nav.js"></script> at the end of each standalone HTML page.
 *
 * Provides:
 *  - Sticky header with branding + navigation (auto-hides on scroll down)
 *  - Dropdown menus for Documents, Forms, Training
 *  - Print / Save as PDF button
 *  - Back-to-top floating button
 *  - Version/approval footer (reads data-* attributes from <body>)
 */
(function () {
  'use strict';

  // ── Design tokens ──
  var NAVY = '#1B3A4B';
  var NAVY_DEEP = '#0F2530';
  var TEAL = '#2E6B7F';
  var GOLD = '#B09055';
  var GOLD_WARM = '#C4A46A';
  var CREAM = '#FAF8F3';
  var WHITE = '#FFFFFF';
  var MUTED = '#9A958F';
  var BORDER = '#E4E0DA';
  var SANS = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
  var SERIF = "'DM Serif Display', Georgia, serif";

  // ── Inject Google Fonts if not already loaded ──
  if (!document.querySelector('link[href*="DM+Serif+Display"]')) {
    var fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(fontLink);
  }

  // ── Document Map — all linkable documents ──
  var DOCS = {
    'SG-G-001':    { title: 'Safeguard Governance Policy',      href: 'SG-G-001.html' },
    'SG-POL-001':  { title: 'Volunteer Screening & Approval',   href: 'SG-POL-001.html' },
    'SG-POL-002':  { title: 'Supervision Standards',            href: 'SG-POL-002.html' },
    'SG-POL-003':  { title: 'Bathroom & Diapering Protocols',   href: 'SG-POL-003.html' },
    'SG-POL-004':  { title: 'Reporting & Response',             href: 'SG-POL-004.html' },
    'SG-FRM-001':  { title: 'Ministry Application',             href: null },
    'SG-FRM-002':  { title: 'Reference Check',                  href: null },
    'SG-FRM-003':  { title: 'Police Check Letter & Consent',    href: null },
    'SG-FRM-004':  { title: 'Worker\'s Covenant & Acknowledgement', href: null },
    'SG-FRM-005':  { title: 'Child Registration & Medical Release', href: null },
    'SG-FRM-006':  { title: 'Incident / Accident Report',       href: null },
    'SG-FRM-007':  { title: 'Suspected Abuse Report',           href: null },
    'SG-FRM-008':  { title: 'Sign-In / Sign-Out & Attendance',  href: null },
    'SG-FRM-009':  { title: 'Event / Activity Permission & Waiver', href: null },
    'SG-FRM-010':  { title: 'Driver Application & Authorization', href: null },
    'SG-FRM-011':  { title: 'Transportation Log & Trip Plan',   href: null },
    'SG-FRM-012':  { title: 'Training Completion Record',       href: null },
    'SG-SOP-001':  { title: 'Screening & Onboarding Checklist', href: null },
    'SG-SOP-002':  { title: 'Washroom Escort Protocol',         href: null },
    'SG-SOP-003':  { title: 'Ratio / Room Capacity Card',       href: null },
    'SG-SOP-004':  { title: 'Reporting Flowchart',              href: null },
    'SG-SOP-005':  { title: 'Receiving & Releasing Children',   href: null },
    'SG-SOP-006':  { title: 'Emergency & Injury Protocols',     href: null },
    'SG-SOP-007':  { title: 'Transportation & Off-Site Safety', href: null },
    'SG-T-001':    { title: 'Why We Protect & How It Works',    href: 'SG-T-001.html' },
    'SG-T-002':    { title: 'Supervision: Two-Adult Rule, Ratios & High-Risk Settings', href: 'SG-T-002.html' },
    'SG-T-003':    { title: 'Recognizing Abuse & Reporting It', href: 'SG-T-003.html' },
    'SG-T-004':    { title: 'Operations, Safety & Your Commitment', href: 'SG-T-004.html' },
    'SG-T-101':    { title: 'Leading & Sustaining the Safeguard System', href: 'SG-T-101.html' },
    'SG-T-102':    { title: 'Screening & Managing Volunteers',  href: 'SG-T-102.html' },
    'SG-T-103':    { title: 'Incidents, Compliance & Oversight', href: 'SG-T-103.html' },
    'SG-T-REF-001': { title: 'Leader Quick-Reference Guide',    href: 'SG-T-REF-001.html' }
  };

  // ── Navigation structure ──
  var NAV_ITEMS = [
    { label: 'Hub', href: 'index.html', children: null },
    { label: 'Documents', href: null, children: [
      { group: 'Governance', items: [{ code: 'SG-G-001' }] },
      { group: 'Core Policies', items: [{ code: 'SG-POL-001' }, { code: 'SG-POL-002' }, { code: 'SG-POL-003' }, { code: 'SG-POL-004' }] }
    ]},
    { label: 'Training', href: null, children: [
      { group: 'Volunteer Track', items: [{ code: 'SG-T-001' }, { code: 'SG-T-002' }, { code: 'SG-T-003' }, { code: 'SG-T-004' }] },
      { group: 'Leader Track', items: [{ code: 'SG-T-101' }, { code: 'SG-T-102' }, { code: 'SG-T-103' }] },
      { group: 'Reference', items: [{ code: 'SG-T-REF-001' }] }
    ]}
  ];

  // ── Build the nav bar ──
  var header = document.createElement('div');
  header.id = 'sg-nav-header';
  header.className = 'no-print';

  var headerCSS = [
    '#sg-nav-header {',
    '  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;',
    '  background: ' + NAVY_DEEP + ';',
    '  border-bottom: 2px solid ' + GOLD + '40;',
    '  transform: translateY(0); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);',
    '  font-family: ' + SANS + ';',
    '}',
    '#sg-nav-header.sg-nav-hidden { transform: translateY(-100%); }',
    '#sg-nav-inner {',
    '  max-width: 920px; margin: 0 auto; padding: 0 24px;',
    '  display: flex; align-items: center; height: 56px; gap: 8px;',
    '}',
    '#sg-nav-brand {',
    '  font-family: ' + SERIF + '; font-size: 18px; color: ' + WHITE + ';',
    '  text-decoration: none; margin-right: auto; display: flex; align-items: center; gap: 10px;',
    '  white-space: nowrap;',
    '}',
    '#sg-nav-brand:hover { color: ' + GOLD_WARM + '; }',
    '#sg-nav-brand small {',
    '  font-family: ' + SANS + '; font-size: 9px; font-weight: 700;',
    '  letter-spacing: 0.18em; text-transform: uppercase; color: ' + GOLD + ';',
    '}',
    '.sg-nav-link {',
    '  position: relative; padding: 8px 16px; font-size: 14px; font-weight: 600;',
    '  color: rgba(255,255,255,0.75); background: none; border: none;',
    '  cursor: pointer; border-radius: 6px; transition: all 0.15s;',
    '  text-decoration: none; display: flex; align-items: center; gap: 5px;',
    '}',
    '.sg-nav-link:hover { color: ' + WHITE + '; background: rgba(255,255,255,0.08); }',
    '.sg-nav-link svg { width: 10px; height: 10px; opacity: 0.5; }',
    '.sg-nav-dropdown {',
    '  display: none; position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);',
    '  background: ' + WHITE + '; border-radius: 12px; padding: 12px 0;',
    '  box-shadow: 0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);',
    '  border: 1px solid ' + BORDER + '; min-width: 280px;',
    '  z-index: 10000;',
    '}',
    '.sg-nav-link:hover .sg-nav-dropdown,',
    '.sg-nav-link:focus-within .sg-nav-dropdown { display: block; }',
    '.sg-nav-group-label {',
    '  font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;',
    '  color: ' + GOLD + '; padding: 8px 20px 4px; margin-top: 4px;',
    '}',
    '.sg-nav-group-label:first-child { margin-top: 0; }',
    '.sg-nav-dd-item {',
    '  display: block; padding: 8px 20px; font-size: 13px; font-weight: 500;',
    '  color: #3D3835; text-decoration: none; transition: all 0.1s;',
    '  line-height: 1.4;',
    '}',
    '.sg-nav-dd-item:hover { background: ' + CREAM + '; color: ' + TEAL + '; }',
    '.sg-nav-dd-item .sg-nav-dd-code {',
    '  font-size: 11px; font-weight: 700; color: ' + TEAL + '; margin-right: 8px;',
    '}',
    '.sg-nav-action {',
    '  padding: 7px 14px; font-size: 12px; font-weight: 700;',
    '  color: ' + GOLD_WARM + '; background: rgba(176,144,85,0.1);',
    '  border: 1px solid rgba(176,144,85,0.2); border-radius: 6px;',
    '  cursor: pointer; transition: all 0.15s; margin-left: 4px;',
    '}',
    '.sg-nav-action:hover { background: rgba(176,144,85,0.2); }',
    '',
    '/* Back to top */',
    '#sg-nav-top-btn {',
    '  position: fixed; bottom: 28px; right: 28px; z-index: 9998;',
    '  width: 44px; height: 44px; border-radius: 50%;',
    '  background: ' + NAVY + '; color: ' + WHITE + ';',
    '  border: none; cursor: pointer; font-size: 18px;',
    '  box-shadow: 0 4px 16px rgba(27,58,75,0.3);',
    '  opacity: 0; transform: translateY(12px); pointer-events: none;',
    '  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);',
    '  display: flex; align-items: center; justify-content: center;',
    '}',
    '#sg-nav-top-btn.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }',
    '#sg-nav-top-btn:hover { background: ' + TEAL + '; transform: translateY(-2px); }',
    '',
    '/* Footer */',
    '#sg-nav-footer {',
    '  max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem 3rem;',
    '  border-top: 1px solid ' + BORDER + ';',
    '  font-family: ' + SANS + '; font-size: 11px; color: ' + MUTED + ';',
    '  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;',
    '}',
    '#sg-nav-footer a { color: ' + TEAL + '; text-decoration: none; }',
    '#sg-nav-footer a:hover { text-decoration: underline; }',
    '',
    '/* Push body down for fixed header */',
    'body.sg-nav-active { padding-top: 60px; }',
    '',
    '/* Mobile */',
    '@media (max-width: 640px) {',
    '  #sg-nav-inner { padding: 0 16px; height: 50px; }',
    '  #sg-nav-brand { font-size: 15px; }',
    '  #sg-nav-brand small { display: none; }',
    '  .sg-nav-link { padding: 6px 10px; font-size: 13px; }',
    '  .sg-nav-dropdown { min-width: 240px; left: auto; right: -16px; transform: none; }',
    '  .sg-nav-action { padding: 6px 10px; font-size: 11px; }',
    '  #sg-nav-top-btn { bottom: 20px; right: 20px; width: 40px; height: 40px; font-size: 16px; }',
    '}',
    '@media print {',
    '  #sg-nav-header, #sg-nav-top-btn { display: none !important; }',
    '  body.sg-nav-active { padding-top: 0 !important; }',
    '}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = headerCSS;
  document.head.appendChild(style);

  // ── Chevron SVG ──
  var chevron = '<svg viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l4 4 4-4"/></svg>';

  // ── Build nav HTML ──
  var navHTML = '<div id="sg-nav-inner">';
  navHTML += '<a id="sg-nav-brand" href="index.html"><small>Safeguard Framework</small> Bethany Chapel</a>';

  NAV_ITEMS.forEach(function (item) {
    if (!item.children) {
      navHTML += '<a class="sg-nav-link" href="' + item.href + '">' + item.label + '</a>';
    } else {
      navHTML += '<button class="sg-nav-link" type="button">' + item.label + ' ' + chevron;
      navHTML += '<div class="sg-nav-dropdown">';
      item.children.forEach(function (group) {
        navHTML += '<div class="sg-nav-group-label">' + group.group + '</div>';
        group.items.forEach(function (gi) {
          var d = DOCS[gi.code];
          if (d && d.href) {
            navHTML += '<a class="sg-nav-dd-item" href="' + d.href + '"><span class="sg-nav-dd-code">' + gi.code + '</span>' + d.title + '</a>';
          } else {
            navHTML += '<span class="sg-nav-dd-item" style="opacity:0.5;cursor:default"><span class="sg-nav-dd-code">' + gi.code + '</span>' + (d ? d.title : gi.code) + '</span>';
          }
        });
      });
      navHTML += '</div></button>';
    }
  });

  navHTML += '<button class="sg-nav-action" onclick="window.print()" title="Print / Save as PDF">Print</button>';
  navHTML += '</div>';

  header.innerHTML = navHTML;
  document.body.insertBefore(header, document.body.firstChild);
  document.body.classList.add('sg-nav-active');

  // ── Back to top button ──
  var topBtn = document.createElement('button');
  topBtn.id = 'sg-nav-top-btn';
  topBtn.className = 'no-print';
  topBtn.innerHTML = '&#8593;';
  topBtn.title = 'Back to top';
  topBtn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.body.appendChild(topBtn);

  // ── Scroll behavior: auto-hide header + show/hide back-to-top ──
  var lastScroll = 0;
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(function () {
        var current = window.pageYOffset || document.documentElement.scrollTop;
        // Auto-hide header
        if (current > 120 && current > lastScroll) {
          header.classList.add('sg-nav-hidden');
        } else {
          header.classList.remove('sg-nav-hidden');
        }
        // Back to top
        if (current > 400) {
          topBtn.classList.add('visible');
        } else {
          topBtn.classList.remove('visible');
        }
        lastScroll = current;
        ticking = false;
      });
      ticking = true;
    }
  });

  // ── Version/Approval Footer ──
  // Reads from <body data-doc-code="SG-T-001" data-doc-version="3.0" data-doc-date="March 2026" data-doc-status="Approved">
  var body = document.body;
  var docCode = body.getAttribute('data-doc-code');
  var docVersion = body.getAttribute('data-doc-version');
  var docDate = body.getAttribute('data-doc-date');
  var docStatus = body.getAttribute('data-doc-status') || 'Approved';

  if (docCode) {
    var footer = document.createElement('div');
    footer.id = 'sg-nav-footer';
    var left = docCode;
    if (docVersion) left += ' · v' + docVersion;
    if (docDate) left += ' · ' + docDate;
    left += ' · ' + docStatus;
    footer.innerHTML = '<span>' + left + '</span><a href="index.html">Safeguard Hub →</a>';
    // Insert before the closing </body> but after .page-wrapper
    var wrapper = document.querySelector('.page-wrapper');
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.insertBefore(footer, wrapper.nextSibling);
    } else {
      document.body.appendChild(footer);
    }
  }

  // ── Utility: Auto-link any remaining SG-XXX-NNN codes in body text ──
  // This is a helper that pages can call if they want auto-hyperlinking.
  // It's NOT run automatically to avoid breaking existing <a> tags.
  window.SG_Nav = {
    DOCS: DOCS,
    // Link a specific code: returns an <a> tag string or the code string if no href
    link: function (code, label) {
      var d = DOCS[code];
      if (!d) return code;
      var text = label || (code + ' (' + d.title + ')');
      if (d.href) return '<a href="' + d.href + '" style="color:' + TEAL + ';text-decoration:none;border-bottom:1px solid ' + TEAL + '40">' + text + '</a>';
      return '<span style="color:' + TEAL + ';font-weight:600" title="' + d.title + '">' + text + '</span>';
    }
  };
})();
