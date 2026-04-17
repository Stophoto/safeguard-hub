/**
 * sg-nav.js v2 — Unified Navigation for the Safeguard Framework
 * Loaded via <script src="sg-nav.js"></script> on every standalone page.
 * The Hub (index.html) uses the same nav directly (skip this script there
 * since Hub already renders its own copy inside its React tree).
 *
 * Provides:
 *  - Sticky navy header with shield + eyebrow "Safeguard Framework" + church name
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

  // ── Inject Google Fonts if not already loaded ──
  if (!document.querySelector('link[href*="DM+Serif+Display"]')) {
    var fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(fontLink);
  }

  // ── Document registry — every linkable doc ──
  var DOCS = {
    'SG-G-001':    { title: 'Safeguard Governance Policy',      href: 'SG-G-001.html' },
    'SG-POL-001':  { title: 'Volunteer Screening & Approval',   href: 'SG-POL-001.html' },
    'SG-POL-002':  { title: 'Supervision Standards',            href: 'SG-POL-002.html' },
    'SG-POL-003':  { title: 'Bathroom & Diapering Protocols',   href: 'SG-POL-003.html' },
    'SG-POL-004':  { title: 'Reporting & Response',             href: 'SG-POL-004.html' },
    'SG-FRM-001':  { title: 'Ministry Application',             href: 'index.html#frm001', fillable: true },
    'SG-FRM-002':  { title: 'Reference Check',                  href: null },
    'SG-FRM-003':  { title: "Police Check Letter & Consent",    href: null },
    'SG-FRM-004':  { title: "Worker's Covenant & Acknowledgement", href: null },
    'SG-FRM-005':  { title: 'Child Registration & Medical Release', href: null },
    'SG-FRM-006':  { title: 'Incident / Accident Report',       href: 'index.html#frm006', fillable: true },
    'SG-FRM-007':  { title: 'Suspected Abuse Report',           href: 'index.html#frm007', fillable: true },
    'SG-FRM-008':  { title: 'Sign-In / Sign-Out & Attendance',  href: null },
    'SG-FRM-009':  { title: 'Event Permission & Waiver',        href: null },
    'SG-FRM-010':  { title: 'Driver Application',               href: null },
    'SG-FRM-011':  { title: 'Transportation Log & Trip Plan',   href: null },
    'SG-FRM-012':  { title: 'Training Completion Record',       href: 'index.html#frm012', fillable: true },
    'SG-SOP-001':  { title: 'Screening & Onboarding Checklist', href: null },
    'SG-SOP-002':  { title: 'Washroom Escort Protocol',         href: null },
    'SG-SOP-003':  { title: 'Ratio / Room Capacity Card',       href: null },
    'SG-SOP-004':  { title: 'Reporting Flowchart',              href: null },
    'SG-SOP-005':  { title: 'Receiving & Releasing Children',   href: null },
    'SG-SOP-006':  { title: 'Emergency & Injury Protocols',     href: null },
    'SG-SOP-007':  { title: 'Transportation & Off-Site Safety', href: null },
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
    { label: 'Documents', groups: [
      { label: 'Governance', items: ['SG-G-001'] },
      { label: 'Core Policies', items: ['SG-POL-001','SG-POL-002','SG-POL-003','SG-POL-004'] }
    ]},
    { label: 'Forms', groups: [
      { label: 'Fillable · opens inline', items: ['SG-FRM-001','SG-FRM-006','SG-FRM-007','SG-FRM-012'] },
      { label: 'Printable', items: ['SG-FRM-002','SG-FRM-003','SG-FRM-004','SG-FRM-005','SG-FRM-008','SG-FRM-009','SG-FRM-010','SG-FRM-011'] }
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
    '  margin-right: auto; text-decoration: none; }',
    '#sg-nav-brand .sg-brand-text { display: flex; flex-direction: column; line-height: 1.05; }',
    '#sg-nav-brand small { font-size: 9px; font-weight: 700; letter-spacing: 0.22em;',
    '  color: '+GOLD+'; text-transform: uppercase; }',
    '#sg-nav-brand .sg-brand-name { font-family: '+SERIF+'; font-size: 19px;',
    '  color: '+WHITE+'; margin-top: 2px; }',
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
    '.sg-nav-dropdown { display: none; position: absolute; top: calc(100% + 6px);',
    '  left: 50%; transform: translateX(-50%); background: '+WHITE+';',
    '  border-radius: 12px; padding: 14px 0; min-width: 340px;',
    '  box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08);',
    '  border: 1px solid '+BORDER+'; z-index: 10000; }',
    '.sg-nav-item:hover .sg-nav-dropdown { display: block; }',
    '.sg-dd-group { font-size: 10px; font-weight: 700; letter-spacing: 0.12em;',
    '  text-transform: uppercase; color: '+GOLD+'; padding: 10px 20px 6px; }',
    '.sg-dd-group:first-child { padding-top: 4px; }',
    '.sg-dd-item { display: flex; gap: 10px; padding: 7px 20px; font-size: 13px;',
    '  color: '+BODY+'; text-decoration: none; line-height: 1.4;',
    '  transition: all 0.1s; cursor: pointer; }',
    '.sg-dd-item:hover { background: '+CREAM+'; color: '+TEAL+'; }',
    '.sg-dd-item .sg-dd-code { font-size: 11px; font-weight: 700; color: '+TEAL+';',
    '  min-width: 84px; flex-shrink: 0; }',
    '.sg-dd-item.disabled { opacity: 0.45; cursor: default; }',
    '.sg-dd-item.disabled:hover { background: none; color: '+BODY+'; }',
    '.sg-nav-action { padding: 8px 16px; font-size: 12px; font-weight: 700;',
    '  color: '+GOLD_WARM+'; background: rgba(176,144,85,0.12);',
    '  border: 1px solid rgba(176,144,85,0.25); border-radius: 6px;',
    '  cursor: pointer; transition: all 0.15s; margin-left: 8px;',
    '  font-family: '+SANS+'; letter-spacing: 0.02em; }',
    '.sg-nav-action:hover { background: rgba(176,144,85,0.22); }',
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
    // Mobile
    '@media (max-width: 760px) {',
    '  #sg-nav-inner { padding: 0 16px; height: 54px; gap: 0; }',
    '  #sg-nav-brand small { font-size: 8px; letter-spacing: 0.18em; }',
    '  #sg-nav-brand .sg-brand-name { font-size: 15px; }',
    '  .sg-nav-link { padding: 6px 10px; font-size: 12px; }',
    '  .sg-nav-link .sg-nav-label-long { display: none; }',
    '  .sg-nav-dropdown { min-width: 260px; left: auto; right: 0;',
    '    transform: none; }',
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
        + '<div class="sg-brand-text"><small>Safeguard Framework</small>'
        + '<span class="sg-brand-name">'+CHURCH+'</span></div></a>';

  NAV.forEach(function (item) {
    if (!item.groups) {
      html += '<div class="sg-nav-item"><a class="sg-nav-link" href="'+item.href+'">'+item.label+'</a></div>';
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

  // Save PDF only on non-Hub pages
  var onHub = /(?:^|\/)index\.html?$/i.test(location.pathname) || location.pathname.endsWith('/');
  if (!onHub) {
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
    footer.innerHTML = '<span>'+left+'</span><a href="index.html">Safeguard Hub →</a>';
    var wrapper = document.querySelector('.page-wrapper, .pw');
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.insertBefore(footer, wrapper.nextSibling);
    } else {
      document.body.appendChild(footer);
    }
  }

  // Public API for hand-linking codes in page content
  window.SG_Nav = {
    DOCS: DOCS,
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
