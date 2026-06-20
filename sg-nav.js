/**
 * sg-nav.js v2 — Unified Navigation for the Safeguard Framework
 * Loaded via <script src="sg-nav.js"></script> on every standalone page.
 * The Hub (index.html) uses the same nav directly (skip this script there
 * since Hub already renders its own copy inside its React tree).
 *
 * Provides:
 *  - Sticky navy header with shield + eyebrow "Safeguard Hub" + church name
 *  - Full-coverage dropdowns: Hub · Documents · Forms · SOPs · Training · Admin
 *  - Breadcrumb back-trail row (derived from document.referrer)
 *  - "Save PDF" button (calls window.print())
 *  - Auto-hide on scroll-down, reveal on scroll-up
 *  - Back-to-top floating button
 *  - Version/approval footer from <body data-doc-*> attrs
 */
(function () {
  'use strict';

  // ── Design tokens (match existing site) ──
  var NAVY = '#1B3A4B';
  var NAVY_DEEP = '#0F2530';
  var TEAL = '#2E6B7F';
  var GOLD = '#B09055';
  var GOLD_WARM = '#C4A46A';
  var CREAM = '#FAF8F3';
  var WHITE = '#FFFFFF';
  var MUTED = '#9A958F';
  var BORDER = '#E4E0DA';
  var BODY = '#3D3835';
  var SANS = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
  var SERIF = "'DM Serif Display', Georgia, serif";
  var LOGO_FONT = "'Archivo', " + SANS;  // bold geometric sans, matched to the Bethany Chapel logo

  // ── Inject Google Fonts if not already loaded ──
  if (!document.querySelector('link[href*="DM+Serif+Display"]')) {
    var fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap';
    fontLink.integrity = 'sha384-OrDai7FVovo0Oy2LGx2+cgUuBlW1mselxN+LN2wvDIyvsMon6y+d7I5jJy+Gw/nZ';
    fontLink.crossOrigin = 'anonymous';
    document.head.appendChild(fontLink);
  }
  // Logo-matching font for the brand name (separate link; CSP allows fonts.googleapis.com)
  if (!document.querySelector('link[href*="family=Archivo"]')) {
    var logoFont = document.createElement('link');
    logoFont.rel = 'stylesheet';
    logoFont.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&display=swap';
    logoFont.crossOrigin = 'anonymous';
    document.head.appendChild(logoFont);
  }

  // ── Document registry — every linkable doc ──
  var DOCS = {
    'SG-G-001':    { title: 'Safeguard Governance Policy',      href: 'SG-G-001.html' },
    'SG-POL-001':  { title: 'Volunteer Screening & Approval',   href: 'SG-POL-001.html' },
    'SG-POL-002':  { title: 'Supervision Standards',            href: 'SG-POL-002.html' },
    'SG-POL-003':  { title: 'Bathroom & Diapering Protocols',   href: 'SG-POL-003.html' },
    'SG-POL-004':  { title: 'Reporting & Response',             href: 'SG-POL-004.html' },
    'SG-FRM-001':  { title: 'Ministry Application',             href: 'SG-FRM-001.html', fillable: true },
    'SG-FRM-002':  { title: 'Reference Check',                  href: 'SG-FRM-002.html' },
    'SG-FRM-003':  { title: "Police Check Letter & Consent",    href: 'SG-FRM-003.html' },
    'SG-FRM-004':  { title: "Worker's Covenant & Acknowledgement", href: 'covenant.html' },
    'SG-FRM-005':  { title: 'Child Registration & Medical Release', href: 'SG-FRM-005.html' },
    'SG-FRM-006':  { title: 'Incident / Accident Report',       href: 'SG-FRM-006.html', fillable: true },
    'SG-FRM-007':  { title: 'Suspected Abuse Report',           href: 'SG-FRM-007.html', fillable: true },
    'SG-FRM-008-session': { title: 'Session Check Sheet (printable)', href: 'SG-FRM-008-session-check-sheet.html' },
    'SG-FRM-009':  { title: 'Event Permission & Waiver',        href: 'SG-FRM-009.html' },
    'SG-FRM-010':  { title: 'Driver Application',               href: 'SG-FRM-010.html' },
    'SG-FRM-011':  { title: 'Transportation Log & Trip Plan',   href: 'SG-FRM-011.html' },
    'SG-FRM-012':  { title: 'Training Completion Record',       href: 'index.html#frm012', fillable: true },
    'SG-SOP-001':  { title: 'Screening & Onboarding Checklist', href: 'SG-SOP-001.html' },
    'SG-SOP-002':  { title: 'Washroom Escort Protocol',         href: 'SG-SOP-002.html' },
    'SG-SOP-002-cards': { title: 'Washroom Escort Card (printable)', href: 'SG-SOP-002-cards.html' },
    'SG-SOP-003':  { title: 'Ratio / Room Capacity Card',       href: 'SG-SOP-003.html' },
    'SG-SOP-003-cards': { title: 'Room Posters (printable)',    href: 'SG-SOP-003-cards.html' },
    'SG-SOP-003-room-full': { title: 'Room Full Sign (printable)', href: 'SG-SOP-003-room-full-sign.html' },
    'SG-SOP-004':  { title: 'Reporting Flowchart',              href: 'SG-SOP-004.html' },
    'SG-SOP-004-cards': { title: 'Reporting Flowchart Poster (printable)', href: 'SG-SOP-004-cards.html' },
    'SG-SOP-005':  { title: 'Receiving & Releasing Children',   href: 'SG-SOP-005.html' },
    'SG-SOP-005-cards': { title: 'Receiving & Releasing Card (printable)', href: 'SG-SOP-005-cards.html' },
    'SG-SOP-006':  { title: 'Emergency & Injury Protocols',     href: 'SG-SOP-006.html' },
    'SG-SOP-006-cards': { title: 'Emergency & Injury Poster (printable)', href: 'SG-SOP-006-cards.html' },
    'SG-SOP-007':  { title: 'Transportation & Off-Site Safety', href: 'SG-SOP-007.html' },
    'SG-T-001':    { title: 'Why We Protect & How It Works',    href: 'SG-T-001.html' },
    'SG-T-002':    { title: 'Supervision: Two-Adult Rule & Ratios', href: 'SG-T-002.html' },
    'SG-T-003':    { title: 'Recognizing Abuse & Reporting It', href: 'SG-T-003.html' },
    'SG-T-004':    { title: 'Operations, Safety & Your Commitment', href: 'SG-T-004.html' },
    'SG-T-101':    { title: 'Leading & Sustaining the System',  href: 'SG-T-101.html' },
    'SG-T-102':    { title: 'Screening & Managing Volunteers',  href: 'SG-T-102.html' },
    'SG-T-103':    { title: 'Incidents, Compliance & Oversight', href: 'SG-T-103.html' },
    'SG-T-REF-001':{ title: 'Leader Quick-Reference Guide',     href: 'SG-T-REF-001.html' }
  };

  var NAV = [
    { label: 'Hub', href: 'index.html' },
    { label: 'Policies', groups: [
      { label: 'Governance', items: ['SG-G-001'] },
      { label: 'Core Policies', items: ['SG-POL-001','SG-POL-002','SG-POL-003','SG-POL-004'] }
    ]},
    { label: 'Forms', groups: [
      { label: 'Fillable forms', items: ['SG-FRM-001','SG-FRM-006','SG-FRM-007','SG-FRM-012'] },
      { label: 'Printable', items: ['SG-FRM-002','SG-FRM-003','SG-FRM-004','SG-FRM-005','SG-FRM-009','SG-FRM-010','SG-FRM-011'] }
    ]},
    { label: 'SOPs', groups: [
      { label: 'Standard Operating Procedures', items: ['SG-SOP-001','SG-SOP-002','SG-SOP-003','SG-SOP-004','SG-SOP-005','SG-SOP-006','SG-SOP-007'] }
    ]},
    { label: 'Training', groups: [
      { label: 'Volunteer Track', items: ['SG-T-001','SG-T-002','SG-T-003','SG-T-004'] },
      { label: 'Leader Track', items: ['SG-T-101','SG-T-102','SG-T-103'] },
      { label: 'Reference', items: ['SG-T-REF-001'] }
    ]},
    { label: 'Admin', href: 'index.html#admin' }
  ];

  // Coordinator-only admin destinations. The Admin nav item is upgraded into
  // a dropdown of these once we know the signed-in user is a coordinator
  // (see setAdminAccess + the auth block below).
  var ADMIN_LINKS = [
    { label: 'People',      href: 'admin.html' },
    { label: 'Screening',   href: 'admin-screening.html' },
    { label: 'Submissions', href: 'admin-submissions.html' },
    { label: 'Tasks',       href: 'admin-tasks.html' },
    { label: 'Room Kit',    href: 'admin-room-kit.html' }
  ];

  // ── Styles ──
  var css = [
    '#sg-nav-header { position: fixed; top: 0; left: 0; right: 0; z-index: 9999;',
    '  background: linear-gradient(180deg, '+NAVY_DEEP+' 0%, '+NAVY+' 100%);',
    '  border-bottom: 2px solid '+GOLD+'40;',
    '  transform: translateY(0); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);',
    '  font-family: '+SANS+'; }',
    '#sg-nav-header.sg-nav-hidden { transform: translateY(-100%); }',
    '#sg-nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 28px;',
    '  display: flex; align-items: center; height: 60px; gap: 2px; }',
    '#sg-nav-brand { display: flex; align-items: center; gap: 12px;',
    '  margin-right: auto; text-decoration: none; flex-shrink: 0; }',
    '#sg-nav-brand .sg-brand-text { display: flex; flex-direction: column; line-height: 1.05; }',
    '#sg-nav-brand small { font-size: 14px; font-weight: 700; letter-spacing: 0.2em;',
    '  color: '+GOLD+'; text-transform: uppercase; white-space: nowrap; }',
    '#sg-nav-brand .sg-brand-name { font-family: '+LOGO_FONT+'; font-size: 18px; font-weight: 700;',
    '  letter-spacing: 0.01em; text-transform: uppercase; color: '+WHITE+'; margin-top: 2px; white-space: nowrap; }',
    '#sg-nav-brand:hover .sg-brand-name { color: '+GOLD_WARM+'; }',
    '.sg-nav-item { position: relative; }',
    '.sg-nav-link { padding: 9px 16px; font-size: 13px; font-weight: 600;',
    '  color: rgba(255,255,255,0.72); background: none; border: none;',
    '  cursor: pointer; border-radius: 6px; transition: all 0.15s;',
    '  text-decoration: none; display: flex; align-items: center; gap: 5px;',
    '  font-family: '+SANS+'; }',
    '.sg-nav-link:hover, .sg-nav-item:hover .sg-nav-link { color: '+WHITE+';',
    '  background: rgba(255,255,255,0.06); }',
    '.sg-nav-link.active { color: '+WHITE+'; background: rgba(255,255,255,0.1); }',
    '.sg-nav-link svg { width: 9px; height: 6px; opacity: 0.6; }',
    '.sg-nav-dropdown { display: none; position: absolute; top: 100%;',
    '  left: 50%; transform: translateX(-50%); background: '+WHITE+';',
    '  border-radius: 12px; padding: 14px 0; min-width: 340px; margin-top: 6px;',
    '  box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08);',
    '  border: 1px solid '+BORDER+'; z-index: 10000; }',
    '.sg-nav-dropdown::before { content: ""; position: absolute; top: -10px;',
    '  left: 0; right: 0; height: 14px; background: transparent; }',
    '.sg-nav-item:hover .sg-nav-dropdown,',
    '.sg-nav-item:focus-within .sg-nav-dropdown { display: block; }',
    '.sg-dd-group { font-size: 10px; font-weight: 700; letter-spacing: 0.12em;',
    '  text-transform: uppercase; color: '+GOLD+'; padding: 10px 20px 6px; }',
    '.sg-dd-group:first-child { padding-top: 4px; }',
    '.sg-dd-item { display: flex; gap: 10px; padding: 7px 20px; font-size: 13px;',
    '  color: '+BODY+'; text-decoration: none; line-height: 1.4;',
    '  transition: all 0.1s; cursor: pointer; }',
    '.sg-dd-item:hover { background: '+CREAM+'; color: '+TEAL+'; }',
    '.sg-dd-item.sg-dd-active { color: '+TEAL+'; font-weight: 600; background: '+CREAM+'; }',
    '.sg-dd-item .sg-dd-code { font-size: 11px; font-weight: 700; color: '+TEAL+';',
    '  min-width: 84px; flex-shrink: 0; }',
    '.sg-dd-item.disabled { opacity: 0.45; cursor: default; }',
    '.sg-dd-item.disabled:hover { background: none; color: '+BODY+'; }',
    '.sg-nav-action { padding: 8px 16px; font-size: 12px; font-weight: 700;',
    '  color: '+GOLD_WARM+'; background: rgba(176,144,85,0.12);',
    '  border: 1px solid rgba(176,144,85,0.25); border-radius: 6px;',
    '  cursor: pointer; transition: all 0.15s; margin-left: 8px; flex-shrink: 0;',
    '  white-space: nowrap; font-family: '+SANS+'; letter-spacing: 0.02em; }',
    '.sg-nav-action:hover { background: rgba(176,144,85,0.22); }',
    '#sg-nav-user-chip { flex-shrink: 0; }',
    // Phase 4: user pill + sign-out (injected when Firebase user is signed in)
    '.sg-user-pill { background: rgba(255,255,255,0.08); color: '+WHITE+';',
    '  padding: 5px 12px; border-radius: 16px; font-size: 11px; font-weight: 500;',
    '  display: flex; gap: 8px; align-items: center; margin-left: 8px;',
    '  font-family: '+SANS+'; }',
    '.sg-user-pill .dot { width: 4px; height: 4px; border-radius: 50%;',
    '  background: '+GOLD_WARM+'; }',
    '.sg-signout-btn { background: none; border: 1px solid rgba(255,255,255,0.2);',
    '  color: rgba(255,255,255,0.72); font-size: 11px; font-weight: 600;',
    '  padding: 5px 10px; border-radius: 6px; cursor: pointer; margin-left: 6px;',
    '  transition: all 0.15s; font-family: '+SANS+'; }',
    '.sg-signout-btn:hover { color: '+WHITE+'; border-color: rgba(255,255,255,0.4); }',
    '#sg-dash-link { margin-left: 4px; }',
    // Breadcrumb row
    '#sg-breadcrumb { position: fixed; top: 60px; left: 0; right: 0; z-index: 9998;',
    '  background: '+WHITE+'; border-bottom: 1px solid '+BORDER+';',
    '  font-family: '+SANS+'; transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); }',
    '#sg-breadcrumb.sg-nav-hidden { transform: translateY(calc(-100% - 60px)); }',
    '#sg-breadcrumb-inner { max-width: 1200px; margin: 0 auto; padding: 10px 28px;',
    '  display: flex; align-items: center; gap: 10px; font-size: 12px; }',
    '#sg-breadcrumb a { color: '+TEAL+'; font-weight: 500; text-decoration: none;',
    '  border: none; }',
    '#sg-breadcrumb a:hover { color: '+NAVY+'; text-decoration: underline; }',
    '#sg-breadcrumb .sg-crumb-sep { color: '+MUTED+'; font-size: 10px; }',
    '#sg-breadcrumb .sg-crumb-current { color: '+NAVY+'; font-weight: 600; }',
    '#sg-breadcrumb .sg-back-arrow { color: '+MUTED+'; font-weight: 500; margin-right: 2px; }',
    // Body push
    'body.sg-nav-active { padding-top: 60px; }',
    'body.sg-nav-active.sg-has-crumb { padding-top: 98px; }',
    // Hide legacy inline headers on standalone pages (the unified nav above
    // replaces them — no need for the per-page "← Dashboard" strip that
    // each form/policy/SOP/training module ships with). Training pages
    // retrofit used the `.sg-hdr` class; forms/policies/SOPs used `.hdr`.
    'body.sg-nav-active > header.hdr, body.sg-nav-active > header.sg-hdr { display: none; }',
    // Back to top
    '#sg-nav-top-btn { position: fixed; bottom: 28px; right: 28px; z-index: 9997;',
    '  width: 44px; height: 44px; border-radius: 50%; background: '+NAVY+';',
    '  color: '+WHITE+'; border: none; cursor: pointer; font-size: 18px;',
    '  box-shadow: 0 4px 16px rgba(27,58,75,0.3); opacity: 0;',
    '  transform: translateY(12px); pointer-events: none;',
    '  transition: all 0.3s cubic-bezier(0.4,0,0.2,1);',
    '  display: flex; align-items: center; justify-content: center; }',
    '#sg-nav-top-btn.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }',
    '#sg-nav-top-btn:hover { background: '+TEAL+'; transform: translateY(-2px); }',
    // Footer
    '#sg-nav-footer { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem 3rem;',
    '  border-top: 1px solid '+BORDER+'; font-family: '+SANS+'; font-size: 11px;',
    '  color: '+MUTED+'; display: flex; justify-content: space-between;',
    '  align-items: center; flex-wrap: wrap; gap: 8px; }',
    '#sg-nav-footer a { color: '+TEAL+'; text-decoration: none; border: none; }',
    '#sg-nav-footer a:hover { text-decoration: underline; }',
    // Reading actions (Back / Mark complete) on document pages
    '#sg-reading-actions { max-width: 720px; margin: 0 auto;',
    '  padding: 1.75rem 1.5rem 0; display: flex; gap: 12px; flex-wrap: wrap; }',
    '#sg-reading-actions button { font-family: '+SANS+'; font-size: 14px;',
    '  font-weight: 600; padding: 11px 20px; border-radius: 8px; cursor: pointer;',
    '  border: 1.5px solid transparent; transition: all 0.2s; }',
    '#sg-reading-actions .sg-ra-back { background: transparent; color: '+TEAL+'; border-color: '+BORDER+'; }',
    '#sg-reading-actions .sg-ra-back:hover { border-color: '+TEAL+'; }',
    '#sg-reading-actions .sg-ra-complete { background: '+NAVY+'; color: '+WHITE+'; }',
    '#sg-reading-actions .sg-ra-complete:hover { background: '+TEAL+'; }',
    '#sg-reading-actions .sg-ra-complete.done { background: #2E7D5B; }',
    '@media print { #sg-reading-actions { display: none !important; } }',
    // Mobile
    '@media (max-width: 760px) {',
    // Nav row scrolls horizontally so all items stay reachable with a swipe.
    '  #sg-nav-inner { padding: 0 16px; height: 54px; gap: 0;',
    '    overflow-x: auto; overflow-y: hidden;',
    '    -webkit-overflow-scrolling: touch; scrollbar-width: none; }',
    '  #sg-nav-inner::-webkit-scrollbar { display: none; height: 0; }',
    '  #sg-nav-brand, .sg-nav-item, .sg-nav-action { flex-shrink: 0; }',
    '  #sg-nav-brand small { font-size: 11px; letter-spacing: 0.16em; }',
    '  #sg-nav-brand .sg-brand-name { font-size: 15px; }',
    '  .sg-nav-link { padding: 6px 10px; font-size: 12px; }',
    '  .sg-nav-link .sg-nav-label-long { display: none; }',
    // Dropdowns anchor to the viewport (position: fixed) so they escape the
    // horizontally-scrolling nav container and stay reachable on a phone.
    '  .sg-nav-dropdown { min-width: 260px; left: auto; right: 8px;',
    '    transform: none; position: fixed; top: 54px;',
    '    max-width: calc(100vw - 16px); }',
    '  .sg-nav-action { padding: 6px 10px; font-size: 11px; }',
    '  body.sg-nav-active { padding-top: 54px; }',
    '  #sg-breadcrumb { top: 54px; }',
    '  #sg-breadcrumb-inner { padding: 8px 16px; font-size: 11px; flex-wrap: wrap; }',
    '  body.sg-nav-active.sg-has-crumb { padding-top: 88px; }',
    '}',
    '@media print {',
    '  #sg-nav-header, #sg-breadcrumb, #sg-nav-top-btn { display: none !important; }',
    '  body.sg-nav-active { padding-top: 0 !important; }',
    '}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── Shield SVG ──
  var shieldSvg = '<svg viewBox="0 0 24 28" width="22" height="26" fill="none" aria-hidden="true">'
    + '<path d="M12 1 L22 5 V14 C22 20 17 25 12 27 C7 25 2 20 2 14 V5 Z" stroke="'+GOLD_WARM+'" stroke-width="1.5"/>'
    + '<path d="M12 1 L22 5 V14 C22 20 17 25 12 27 Z" fill="'+GOLD_WARM+'" fill-opacity="0.12"/>'
    + '</svg>';
  var chev = '<svg viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l4 4 4-4"/></svg>';

  // Church name — pulled from <body data-church="..."> or default
  var CHURCH = document.body.getAttribute('data-church') || 'Bethany Chapel';

  // ── Build nav ──
  var header = document.createElement('div');
  header.id = 'sg-nav-header';
  header.className = 'no-print';

  var html = '<div id="sg-nav-inner">';
  html += '<a id="sg-nav-brand" href="index.html">'
        + shieldSvg
        + '<div class="sg-brand-text"><small>Safeguard Hub</small>'
        + '<span class="sg-brand-name">'+CHURCH+'</span></div></a>';

  NAV.forEach(function (item) {
    if (!item.groups) {
      // Tag the Admin item so the auth block can find it and (for
      // coordinators) upgrade it into a dropdown of admin destinations.
      var idAttr = item.label === 'Admin' ? ' id="sg-nav-admin"' : '';
      html += '<div class="sg-nav-item"'+idAttr+'><a class="sg-nav-link" href="'+item.href+'">'+item.label+'</a></div>';
      return;
    }
    html += '<div class="sg-nav-item">';
    html += '<button class="sg-nav-link" type="button">'+item.label+' '+chev+'</button>';
    html += '<div class="sg-nav-dropdown">';
    item.groups.forEach(function (g) {
      html += '<div class="sg-dd-group">'+g.label+'</div>';
      g.items.forEach(function (code) {
        var d = DOCS[code];
        if (!d) return;
        if (d.href) {
          html += '<a class="sg-dd-item" href="'+d.href+'"><span class="sg-dd-code">'+code+'</span><span>'+d.title+'</span></a>';
        } else {
          html += '<span class="sg-dd-item disabled"><span class="sg-dd-code">'+code+'</span><span>'+d.title+'</span></span>';
        }
      });
    });
    html += '</div></div>';
  });

  // Save PDF only on printable document pages (those carrying a doc code).
  // App pages (admin, dashboard, onboarding flows) have no data-doc-code and
  // shouldn't show a Save PDF button.
  var onHub = /(?:^|\/)index\.html?$/i.test(location.pathname) || location.pathname.endsWith('/');
  var isDocPage = !!document.body.getAttribute('data-doc-code');
  if (!onHub && isDocPage) {
    html += '<button class="sg-nav-action" onclick="window.print()" title="Save as PDF or print">Save PDF</button>';
  }
  html += '</div>';

  header.innerHTML = html;
  document.body.insertBefore(header, document.body.firstChild);
  document.body.classList.add('sg-nav-active');

  // ── Breadcrumb back-trail (built from sessionStorage trail) ──
  // We maintain a trail of {code,title,href} in sessionStorage as the user
  // navigates. If they arrived on a page not already in the trail, append it.
  // If they arrived on a page already in the trail (e.g. via breadcrumb click),
  // truncate the trail to that point.
  var body = document.body;
  var thisCode = body.getAttribute('data-doc-code');
  var thisTitle = (thisCode && DOCS[thisCode] && DOCS[thisCode].title) || document.title.split('—').pop().trim() || 'Page';
  var thisHref = location.pathname.split('/').pop() || 'index.html';
  // Hub override
  if (onHub) { thisCode = null; thisTitle = 'Hub'; thisHref = 'index.html'; }

  var TRAIL_KEY = 'sg_nav_trail_v1';
  var trail;
  try { trail = JSON.parse(sessionStorage.getItem(TRAIL_KEY) || '[]'); }
  catch(e) { trail = []; }

  // If current page exists in trail, truncate trail at its index
  var existingIdx = -1;
  for (var i = 0; i < trail.length; i++) {
    if (trail[i].href === thisHref) { existingIdx = i; break; }
  }
  if (existingIdx >= 0) {
    trail = trail.slice(0, existingIdx + 1);
  } else {
    trail.push({ code: thisCode, title: thisTitle, href: thisHref });
  }
  // Cap trail length at 6 to avoid runaway depth
  if (trail.length > 6) trail = trail.slice(trail.length - 6);
  try { sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail)); } catch(e){}

  // Render breadcrumb only if there's more than just this page
  if (trail.length > 1) {
    var crumb = document.createElement('div');
    crumb.id = 'sg-breadcrumb';
    crumb.className = 'no-print';
    var inner = '<div id="sg-breadcrumb-inner"><span class="sg-back-arrow">←</span>';
    trail.forEach(function (t, idx) {
      var isLast = idx === trail.length - 1;
      if (isLast) {
        inner += '<span class="sg-crumb-current">'+t.title+'</span>';
      } else {
        inner += '<a href="'+t.href+'">'+t.title+'</a>';
        inner += '<span class="sg-crumb-sep">›</span>';
      }
    });
    inner += '</div>';
    crumb.innerHTML = inner;
    document.body.insertBefore(crumb, header.nextSibling);
    document.body.classList.add('sg-has-crumb');
  }

  // ── Back-to-top button ──
  var topBtn = document.createElement('button');
  topBtn.id = 'sg-nav-top-btn';
  topBtn.className = 'no-print';
  topBtn.innerHTML = '&#8593;';
  topBtn.title = 'Back to top';
  topBtn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.body.appendChild(topBtn);

  // ── Scroll behavior ──
  var lastScroll = 0, ticking = false;
  var crumbEl = document.getElementById('sg-breadcrumb');
  window.addEventListener('scroll', function () {
    if (ticking) return;
    window.requestAnimationFrame(function () {
      var cur = window.pageYOffset || document.documentElement.scrollTop;
      var hide = cur > 140 && cur > lastScroll;
      header.classList.toggle('sg-nav-hidden', hide);
      if (crumbEl) crumbEl.classList.toggle('sg-nav-hidden', hide);
      topBtn.classList.toggle('visible', cur > 400);
      lastScroll = cur;
      ticking = false;
    });
    ticking = true;
  });

  // ── Document footer (version/approval line) ──
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
    footer.innerHTML = '<span>'+left+'</span><span><a href="privacy.html">Privacy</a> · <a href="index.html">Safeguard Hub →</a></span>';
    var wrapper = document.querySelector('.page-wrapper, .pw');
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.insertBefore(footer, wrapper.nextSibling);
    } else {
      document.body.appendChild(footer);
    }

    // ── Reading actions: Back + Mark complete (reading docs only — not forms or print sheets) ──
    if (!document.querySelector('.sheet') && docCode.indexOf('SG-FRM') !== 0) {
      var ra = document.createElement('div');
      ra.id = 'sg-reading-actions';
      var raKey = 'sg-read-complete:' + docCode;
      var raDone = false;
      try { raDone = localStorage.getItem(raKey) === '1'; } catch (e) {}
      ra.innerHTML = '<button type="button" class="sg-ra-back">&#8592; Back</button>'
        + '<button type="button" class="sg-ra-complete' + (raDone ? ' done' : '') + '">'
        + (raDone ? '&#10003; Completed' : 'Mark as complete') + '</button>';
      footer.parentNode.insertBefore(ra, footer);
      ra.querySelector('.sg-ra-back').addEventListener('click', function () {
        if (window.history.length > 1) { window.history.back(); }
        else { window.location.href = 'dashboard.html'; }
      });
      var raBtn = ra.querySelector('.sg-ra-complete');
      raBtn.addEventListener('click', function () {
        var done = raBtn.classList.toggle('done');
        try { if (done) { localStorage.setItem(raKey, '1'); } else { localStorage.removeItem(raKey); } } catch (e) {}
        raBtn.innerHTML = done ? '&#10003; Completed' : 'Mark as complete';
      });
    }
  }

  // Show/hide + shape the Admin nav item based on coordinator access.
  // Coordinators get a dropdown of admin destinations; everyone else has the
  // item hidden. Idempotent — safe to call on every auth-state change.
  function setAdminAccess(isCoordinator) {
    var adminItem = document.getElementById('sg-nav-admin');
    if (!adminItem) return;
    if (!isCoordinator) {
      adminItem.style.display = 'none';
      adminItem.setAttribute('data-sg-hidden', 'admin');
      return;
    }
    adminItem.style.display = '';
    adminItem.removeAttribute('data-sg-hidden');
    var current = (location.pathname.split('/').pop() || '').toLowerCase();
    var inner = '<button class="sg-nav-link" type="button">Admin '+chev+'</button>';
    inner += '<div class="sg-nav-dropdown"><div class="sg-dd-group">Administration</div>';
    ADMIN_LINKS.forEach(function (l) {
      var active = l.href.toLowerCase() === current ? ' sg-dd-active' : '';
      inner += '<a class="sg-dd-item'+active+'" href="'+l.href+'"><span>'+l.label+'</span></a>';
    });
    inner += '</div>';
    adminItem.innerHTML = inner;
  }

  // Public API for hand-linking codes in page content
  window.SG_Nav = {
    DOCS: DOCS,
    setAdminAccess: setAdminAccess,
    link: function (code, label) {
      var d = DOCS[code];
      if (!d) return code;
      var text = label || (code + ' · ' + d.title);
      if (d.href) return '<a href="'+d.href+'" style="color:'+TEAL+'">'+text+'</a>';
      return '<span style="color:'+TEAL+';font-weight:600" title="'+d.title+'">'+text+'</span>';
    },
    clearTrail: function () { try { sessionStorage.removeItem(TRAIL_KEY); } catch(e){} }
  };
})();

// ─────────────────────────────────────────────────────────────
// Phase 8 · Auth-aware nav enhancements (user chip + role gating)
// Replaces the old Dashboard link + user pill + Sign-out button
// with a single user chip component that opens a dropdown menu
// (My dashboard · Edit profile · Account settings · Sign out).
// Also retargets the Admin nav item based on role.
// ─────────────────────────────────────────────────────────────
(async function () {
  try {
    var authMod = await import('./sg-auth.js');
    var profileMod = await import('./sg-profile.js');
    var chipMod = await import('./sg-user-chip.js');

    authMod.onUserChange(async function (user) {
      var navInner = document.getElementById('sg-nav-inner');
      if (!navInner) return;

      // Clean up legacy Phase 4 injections if any are still lingering
      navInner.querySelectorAll('.sg-user-pill, .sg-signout-btn, #sg-dash-link')
        .forEach(function (el) { el.remove(); });

      // Remove any previously mounted chip container so we can re-mount on auth change
      var existingChip = document.getElementById('sg-nav-user-chip');
      if (existingChip) existingChip.remove();

      if (!user) {
        // Signed out — hide Admin (anonymous visitors have no admin access).
        if (window.SG_Nav) window.SG_Nav.setAdminAccess(false);
        return;
      }

      var profile = null;
      try { profile = await profileMod.getOrCreateProfile(); } catch (_) { return; }

      // Coordinators get an Admin dropdown; everyone else keeps it hidden.
      if (window.SG_Nav) window.SG_Nav.setAdminAccess(profile.role === 'coordinator');

      // Mount the user chip as the last item in the nav row
      // (brand has margin-right:auto which already floats nav items right)
      var chipContainer = document.createElement('div');
      chipContainer.id = 'sg-nav-user-chip';
      chipContainer.style.marginLeft = '8px';
      navInner.appendChild(chipContainer);
      chipMod.mountUserChip(chipContainer);
    });
  } catch (err) {
    // Firebase not available on this page — stay legacy.
    if (window.console) console.warn('sg-nav: auth enhancements skipped:', err && err.message);
  }
})();

// ─────────────────────────────────────────────────────────────
// Shared "Have a question?" help component
// ─────────────────────────────────────────────────────────────
// Adds (1) a persistent, fixed bottom-right "Have a question?" button on
// every page and (2) a shared modal question form. The dashboard's own
// inline button opens the SAME modal by calling window.SGHelp.open().
//
// On submit it POSTs { type:"help_question", name, email, topic, message }
// to the existing Apps Script web app — same URL + Content-Type:text/plain +
// redirect:"follow" transport the rest of the Hub uses (see the archived
// Hub backend client). The Apps Script side emails the Safeguard
// administrator; NO administrator name or email lives in this file.
// ─────────────────────────────────────────────────────────────
(function () {
  'use strict';
  if (window.SGHelp) return; // already mounted (idempotent)

  // Same endpoint + transport the Hub already uses for Sheets writes.
  var BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzaPYsIj00ztt2la7cVrJyxm4OYl3EFS_t-I9u0bXpZV0CeaYvko23OLYYjcYFS4qoxpg/exec';

  // ── Design tokens (match the nav above / existing site) ──
  var NAVY = '#1B3A4B';
  var NAVY_DEEP = '#0F2530';
  var TEAL = '#2E6B7F';
  var GOLD = '#B09055';
  var GOLD_WARM = '#C4A46A';
  var CREAM = '#FAF8F3';
  var WHITE = '#FFFFFF';
  var MUTED = '#6E6862';
  var BORDER = '#E4E0DA';
  var BODY = '#2E2A27';
  var SANS = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
  var SERIF = "'DM Serif Display', Georgia, serif";

  var TOPICS = ['Getting started', 'A specific step', 'Police check', 'Training', 'Something else'];

  // ── Styles ──
  var css = [
    // Persistent launcher button (fixed, bottom-right). Sits to the LEFT of the
    // back-to-top button (#sg-nav-top-btn, right:28px ~44px wide) so neither
    // blocks the other or primary actions.
    '#sg-help-fab { position: fixed; bottom: 28px; right: 84px; z-index: 9996;',
    '  display: inline-flex; align-items: center; gap: 8px;',
    '  padding: 11px 18px; border-radius: 999px; cursor: pointer;',
    '  background: '+NAVY+'; color: '+WHITE+'; border: 1.5px solid '+GOLD+'66;',
    '  font-family: '+SANS+'; font-size: 14px; font-weight: 700; letter-spacing: 0.01em;',
    '  box-shadow: 0 6px 20px rgba(27,58,75,0.34);',
    '  transition: all 0.2s cubic-bezier(0.4,0,0.2,1); }',
    '#sg-help-fab:hover { background: '+TEAL+'; transform: translateY(-2px);',
    '  box-shadow: 0 8px 26px rgba(27,58,75,0.40); }',
    '#sg-help-fab svg { width: 16px; height: 16px; flex-shrink: 0; }',
    '@media (max-width: 760px) {',
    '  #sg-help-fab { bottom: 20px; right: 72px; padding: 10px 15px; font-size: 13px; }',
    '  #sg-help-fab .sg-help-fab-label { display: inline; }',
    '}',
    '@media print { #sg-help-fab, #sg-help-overlay { display: none !important; } }',

    // Overlay / backdrop
    '#sg-help-overlay { position: fixed; inset: 0; z-index: 10001;',
    '  display: none; align-items: center; justify-content: center;',
    '  padding: 20px; background: rgba(15,37,48,0.55);',
    '  font-family: '+SANS+'; -webkit-overflow-scrolling: touch; overflow-y: auto; }',
    '#sg-help-overlay.open { display: flex; }',

    // Modal card
    '.sg-help-modal { background: '+WHITE+'; width: 100%; max-width: 480px;',
    '  border-radius: 16px; border: 1px solid '+BORDER+'; overflow: hidden;',
    '  box-shadow: 0 24px 70px rgba(0,0,0,0.30); position: relative;',
    '  max-height: calc(100vh - 40px); display: flex; flex-direction: column; }',
    '.sg-help-head { background: linear-gradient(180deg, '+NAVY_DEEP+' 0%, '+NAVY+' 100%);',
    '  padding: 22px 26px; border-bottom: 2px solid '+GOLD+'40; flex-shrink: 0; }',
    '.sg-help-head h2 { font-family: '+SERIF+'; color: '+WHITE+'; margin: 0;',
    '  font-size: 24px; font-weight: 400; line-height: 1.15; }',
    '.sg-help-head p { color: rgba(255,255,255,0.86); margin: 8px 0 0;',
    '  font-size: 14px; font-weight: 500; line-height: 1.5; }',
    '.sg-help-close { position: absolute; top: 14px; right: 14px;',
    '  width: 34px; height: 34px; border-radius: 50%; cursor: pointer;',
    '  background: rgba(255,255,255,0.12); border: none; color: '+WHITE+';',
    '  font-size: 20px; line-height: 1; display: flex; align-items: center;',
    '  justify-content: center; transition: background 0.15s; }',
    '.sg-help-close:hover { background: rgba(255,255,255,0.24); }',

    '.sg-help-body { padding: 22px 26px 26px; overflow-y: auto; }',
    '.sg-help-field { margin-bottom: 16px; }',
    '.sg-help-field label { display: block; font-size: 13px; font-weight: 700;',
    '  color: '+NAVY+'; margin-bottom: 6px; letter-spacing: 0.01em; }',
    '.sg-help-field .sg-help-req { color: '+GOLD+'; font-weight: 700; }',
    '.sg-help-field input, .sg-help-field select, .sg-help-field textarea {',
    '  width: 100%; box-sizing: border-box; font-family: '+SANS+';',
    '  font-size: 15px; color: '+BODY+'; background: '+WHITE+';',
    '  border: 1.5px solid '+BORDER+'; border-radius: 9px; padding: 11px 13px;',
    '  transition: border-color 0.15s, box-shadow 0.15s; }',
    '.sg-help-field textarea { min-height: 116px; resize: vertical; line-height: 1.5; }',
    '.sg-help-field input:focus, .sg-help-field select:focus, .sg-help-field textarea:focus {',
    '  outline: none; border-color: '+TEAL+'; box-shadow: 0 0 0 3px '+TEAL+'22; }',
    '.sg-help-field.sg-help-invalid input, .sg-help-field.sg-help-invalid textarea {',
    '  border-color: #C0392B; box-shadow: 0 0 0 3px rgba(192,57,43,0.14); }',
    '.sg-help-error-msg { color: #C0392B; font-size: 12.5px; font-weight: 600;',
    '  margin: 6px 0 0; }',

    '.sg-help-actions { display: flex; gap: 10px; align-items: center;',
    '  margin-top: 6px; }',
    '.sg-help-send { background: '+NAVY+'; color: '+WHITE+'; border: none;',
    '  font-family: '+SANS+'; font-size: 15px; font-weight: 700; letter-spacing: 0.01em;',
    '  padding: 12px 26px; border-radius: 9px; cursor: pointer;',
    '  transition: background 0.18s; }',
    '.sg-help-send:hover:not(:disabled) { background: '+TEAL+'; }',
    '.sg-help-send:disabled { opacity: 0.6; cursor: default; }',
    '.sg-help-cancel { background: none; border: none; color: '+MUTED+';',
    '  font-family: '+SANS+'; font-size: 14px; font-weight: 600; cursor: pointer;',
    '  padding: 12px 8px; }',
    '.sg-help-cancel:hover { color: '+NAVY+'; }',
    '.sg-help-formerr { color: #C0392B; font-size: 13.5px; font-weight: 600;',
    '  margin: 14px 0 0; line-height: 1.5; }',

    // Success / result panel (replaces the form body)
    '.sg-help-result { text-align: center; padding: 14px 6px 8px; }',
    '.sg-help-result .sg-help-check { width: 56px; height: 56px; border-radius: 50%;',
    '  margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;',
    '  background: rgba(46,107,127,0.12); color: '+TEAL+'; font-size: 28px; }',
    '.sg-help-result h3 { font-family: '+SERIF+'; color: '+NAVY+'; margin: 0 0 8px;',
    '  font-size: 22px; font-weight: 400; }',
    '.sg-help-result p { color: '+BODY+'; font-size: 15px; font-weight: 500;',
    '  line-height: 1.55; margin: 0 0 20px; }',
    '.sg-help-result button { background: '+NAVY+'; color: '+WHITE+'; border: none;',
    '  font-family: '+SANS+'; font-size: 15px; font-weight: 700; padding: 11px 26px;',
    '  border-radius: 9px; cursor: pointer; transition: background 0.18s; }',
    '.sg-help-result button:hover { background: '+TEAL+'; }'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── Persistent launcher button ──
  var helpIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  var fab = document.createElement('button');
  fab.id = 'sg-help-fab';
  fab.className = 'no-print';
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Have a question?');
  fab.innerHTML = helpIcon + '<span class="sg-help-fab-label">Have a question?</span>';
  document.body.appendChild(fab);

  // ── Modal scaffolding ──
  var overlay = document.createElement('div');
  overlay.id = 'sg-help-overlay';
  overlay.className = 'no-print';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Ask the Safeguard administrator a question');
  document.body.appendChild(overlay);

  var sending = false;            // in-flight guard (no double-submit)
  var prefill = { name: '', email: '' };
  var lastFocused = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function topicOptions() {
    var out = '<option value="">Choose one (optional)</option>';
    TOPICS.forEach(function (t) { out += '<option value="' + esc(t) + '">' + esc(t) + '</option>'; });
    return out;
  }

  // Render the form (initial state)
  function renderForm() {
    overlay.innerHTML =
      '<div class="sg-help-modal">'
      + '<div class="sg-help-head">'
      +   '<button type="button" class="sg-help-close" aria-label="Close">&times;</button>'
      +   '<h2>Have a question?</h2>'
      +   '<p>Ask away — your question goes straight to our Safeguard administrator. No question is too small.</p>'
      + '</div>'
      + '<div class="sg-help-body">'
      +   '<div class="sg-help-field" data-field="name">'
      +     '<label for="sg-help-name">Your name <span class="sg-help-req">*</span></label>'
      +     '<input id="sg-help-name" type="text" autocomplete="name" value="' + esc(prefill.name) + '">'
      +   '</div>'
      +   '<div class="sg-help-field" data-field="email">'
      +     '<label for="sg-help-email">Your email <span class="sg-help-req">*</span></label>'
      +     '<input id="sg-help-email" type="email" autocomplete="email" value="' + esc(prefill.email) + '">'
      +   '</div>'
      +   '<div class="sg-help-field" data-field="topic">'
      +     '<label for="sg-help-topic">What&rsquo;s this about?</label>'
      +     '<select id="sg-help-topic">' + topicOptions() + '</select>'
      +   '</div>'
      +   '<div class="sg-help-field" data-field="message">'
      +     '<label for="sg-help-message">Your question <span class="sg-help-req">*</span></label>'
      +     '<textarea id="sg-help-message" placeholder="Type your question here…"></textarea>'
      +   '</div>'
      +   '<div class="sg-help-actions">'
      +     '<button type="button" class="sg-help-send">Send</button>'
      +     '<button type="button" class="sg-help-cancel">Cancel</button>'
      +   '</div>'
      +   '<p class="sg-help-formerr" style="display:none"></p>'
      + '</div>'
      + '</div>';

    overlay.querySelector('.sg-help-close').addEventListener('click', close);
    overlay.querySelector('.sg-help-cancel').addEventListener('click', close);
    overlay.querySelector('.sg-help-send').addEventListener('click', submit);

    // Clear a field's invalid state as the user edits it.
    ['name', 'email', 'message'].forEach(function (f) {
      var el = overlay.querySelector('#sg-help-' + f);
      if (el) el.addEventListener('input', function () {
        var wrap = overlay.querySelector('[data-field="' + f + '"]');
        if (wrap) wrap.classList.remove('sg-help-invalid');
        var em = wrap && wrap.querySelector('.sg-help-error-msg');
        if (em) em.remove();
      });
    });

    // Focus the first empty required field (message if name/email pre-filled).
    var focusTarget = !prefill.name ? '#sg-help-name'
      : (!prefill.email ? '#sg-help-email' : '#sg-help-message');
    var ft = overlay.querySelector(focusTarget);
    if (ft) ft.focus();
  }

  function fieldError(field, msg) {
    var wrap = overlay.querySelector('[data-field="' + field + '"]');
    if (!wrap) return;
    wrap.classList.add('sg-help-invalid');
    if (!wrap.querySelector('.sg-help-error-msg')) {
      var p = document.createElement('p');
      p.className = 'sg-help-error-msg';
      p.textContent = msg;
      wrap.appendChild(p);
    }
  }

  function submit() {
    if (sending) return;
    var formErr = overlay.querySelector('.sg-help-formerr');
    if (formErr) { formErr.style.display = 'none'; formErr.textContent = ''; }

    var name = (overlay.querySelector('#sg-help-name').value || '').trim();
    var email = (overlay.querySelector('#sg-help-email').value || '').trim();
    var topic = (overlay.querySelector('#sg-help-topic').value || '').trim();
    var message = (overlay.querySelector('#sg-help-message').value || '').trim();

    // Validation — message is the one field the user must actively complete,
    // but name + email are required too (used as reply-to).
    var ok = true;
    if (!name) { fieldError('name', 'Please add your name.'); ok = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldError('email', 'Please add a valid email so we can reply.'); ok = false;
    }
    if (!message) { fieldError('message', 'Please type your question.'); ok = false; }
    if (!ok) return;

    sending = true;
    var sendBtn = overlay.querySelector('.sg-help-send');
    var cancelBtn = overlay.querySelector('.sg-help-cancel');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }
    if (cancelBtn) cancelBtn.disabled = true;

    var payload = { type: 'help_question', name: name, email: email, topic: topic, message: message };

    fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    })
      .then(function (res) { return res.json().catch(function () { return {}; }); })
      .then(function (result) {
        sending = false;
        if (result && result.success) {
          renderSuccess();
        } else {
          showSendError(sendBtn, cancelBtn);
        }
      })
      .catch(function () {
        sending = false;
        showSendError(sendBtn, cancelBtn);
      });
  }

  function showSendError(sendBtn, cancelBtn) {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
    if (cancelBtn) cancelBtn.disabled = false;
    var formErr = overlay.querySelector('.sg-help-formerr');
    if (formErr) {
      formErr.textContent = 'Something went wrong sending that. Give it another try, or refresh and resubmit.';
      formErr.style.display = '';
    }
  }

  function renderSuccess() {
    var modal = overlay.querySelector('.sg-help-modal');
    if (!modal) return;
    modal.innerHTML =
      '<div class="sg-help-head">'
      +   '<button type="button" class="sg-help-close" aria-label="Close">&times;</button>'
      +   '<h2>Thank you</h2>'
      + '</div>'
      + '<div class="sg-help-body">'
      +   '<div class="sg-help-result">'
      +     '<div class="sg-help-check" aria-hidden="true">&#10003;</div>'
      +     '<h3>Got it — your question&rsquo;s on its way.</h3>'
      +     '<p>Watch your inbox for a reply.</p>'
      +     '<button type="button" class="sg-help-done">Close</button>'
      +   '</div>'
      + '</div>';
    modal.querySelector('.sg-help-close').addEventListener('click', close);
    modal.querySelector('.sg-help-done').addEventListener('click', close);
    var done = modal.querySelector('.sg-help-done');
    if (done) done.focus();
  }

  // ── Open / close ──
  function open() {
    if (overlay.classList.contains('open')) return;
    lastFocused = document.activeElement;
    sending = false;
    // Pre-fill name/email from the logged-in profile (best effort, async).
    prefill = { name: '', email: '' };
    renderForm();
    overlay.classList.add('open');
    document.addEventListener('keydown', onKey);
    loadPrefill();
  }

  function close() {
    if (sending) return; // don't yank the modal mid-send
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    overlay.innerHTML = '';
    if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch (e) {} }
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  // Backdrop click closes (clicks on the modal itself do not bubble to here).
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });

  fab.addEventListener('click', open);

  // ── Pre-fill name/email from the signed-in profile ──
  // Best-effort: if Firebase/profile modules aren't present (e.g. a static doc
  // page), the fields simply stay blank and editable.
  function loadPrefill() {
    Promise.all([
      import('./sg-auth.js').catch(function () { return null; }),
      import('./sg-profile.js').catch(function () { return null; })
    ]).then(function (mods) {
      var authMod = mods[0], profileMod = mods[1];
      if (!profileMod) return;

      function apply(profile, authEmail) {
        if (!overlay.classList.contains('open')) return;
        var nameEl = overlay.querySelector('#sg-help-name');
        var emailEl = overlay.querySelector('#sg-help-email');
        var nm = '';
        if (profile) {
          nm = (profileMod.displayName && profileMod.displayName(profile)) || '';
          if (!nm) {
            nm = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
          }
        }
        var em = (profile && profile.email) || authEmail || '';
        // Only fill empty fields — never clobber what the user has typed.
        if (nameEl && !nameEl.value && nm) { nameEl.value = nm; prefill.name = nm; }
        if (emailEl && !emailEl.value && em) { emailEl.value = em; prefill.email = em; }
      }

      var run = function () {
        profileMod.getOrCreateProfile()
          .then(function (p) {
            var u = authMod && authMod.currentUser ? authMod.currentUser() : null;
            apply(p, u ? u.email : '');
          })
          .catch(function () {});
      };

      // If we know auth state, wait for a signed-in user; otherwise just try.
      if (authMod && authMod.onUserChange) {
        authMod.onUserChange(function (user) { if (user) run(); });
      } else {
        run();
      }
    });
  }

  // Public opener so other pages (e.g. the dashboard's inline button) open
  // the exact same modal.
  window.SGHelp = { open: open, close: close };
})();
