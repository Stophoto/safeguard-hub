# Safeguard Hub Security Review

Review date: 2026-04-28

This is the consolidated security backlog from the Codex review and Claude PII audit. It tracks the active `auth-feature` app served at `https://stophoto.github.io/safeguard-hub/`.

## Priority Findings

### Critical

1. **F-01: Suspected abuse reports need a higher access tier and audit trail.**
   `SG-FRM-007` submissions currently live in the shared `submissions` collection. Any Coordinator can list/read them, and there is no durable "who viewed this" audit log. Add a `safeguard_lead` tier, separate storage or query model for abuse reports, and server-backed audit events for reads.

   Phase A implementation note: Phase A does NOT provide reliable read-audit logs. Direct client reads can occur without audit entries. This is acceptable while no real abuse reports exist. Phase B (Cloud Functions + custom claims + Blaze) MUST be deployed before any real volunteers use this system.

2. **F-02: Legacy Apps Script password was exposed to every signed-in browser.**
   The Hub previously fetched `config/hub.sheetsPassword` and persisted it as `sg_hub_pw` in `localStorage`. Shared devices and devtools could expose it. The first remediation removes this client secret path; any future Sheets mirror must run behind trusted server-side Firebase ID token verification.

### High

3. **F-03: User profile rules must not let volunteers self-clear compliance.**
   Users were blocked from changing only `role` and `status`; other sensitive fields such as police clearance, screening, reference received state, and activation metadata need rule-level protection.

4. **F-04: Submission documents need schema validation.**
   Verified users could create submissions with arbitrary fields, fake review metadata, or oversized payloads. Rules must enforce known keys, known form types, submitter identity, create-time metadata, and coordinator-only triage updates.

5. **F-05: Coordinators can export full roster PII without friction or audit.**
   CSV export contains DOB, address, emergency contact, testimony, and contact details. Add confirmation, role gating, minimization, and audit logging.

6. **F-06: Long-form PII autosaves to browser storage.**
   Several forms save drafts in `localStorage`. Disable autosave for sensitive/minor data, or make it opt-in with clear expiry and logout cleanup.
   2026-04-30 quick win: `SG-FRM-005` no longer autosaves child medical data and removes the old `sg-form-SG-FRM-005` browser draft on load. This is the first slice of the full audit's F-05 autosave finding. Before general volunteer use, replace the silent old-draft cleanup with a one-time warning so users are not surprised if they had an in-progress draft.

7. **F-07: Sensitive payloads appeared in fallback console logs.**
   Legacy offline form branches logged entire submission rows. Remove these logs and fail closed if persistence is unavailable.

### Medium

8. **F-08: No durable audit log for sensitive access or decisions.**
   Add append-only audit events for role/status changes, exports, submission triage, police clearance, references received, and abuse-report views.

9. **F-09: No idle timeout / shared-device cleanup.**
   Add idle timeout that signs out and reloads the page to clear in-memory state.

10. **F-10: Role is stored only in Firestore profile documents.**
    Firestore role checks are usable now, but custom claims would be stronger for high-risk roles once Cloud Functions are introduced.

11. **F-11: UIDs appear in admin query strings.**
    Firestore document IDs are not secrets, but they appear in browser history and referrers. Reduce leakage with `Referrer-Policy` and consider route indirection later.

12. **F-12: Sign-out should force a reload.**
    Reload after sign-out to clear cached PII and in-memory admin state.

### Low

13. **F-13: Mailto workflows may leave PII in sent folders.**
    Keep email bodies minimal and document that coordinator email accounts become part of the records surface.
    Resolved 2026-05-04 in PR https://github.com/Stophoto/safeguard-hub/pull/9: mailto pre-fills no longer include volunteer names, reference names, ministry details, or onboarding status details.

14. **F-14: Privacy notice is missing.**
    Add a plain-language privacy page covering Firebase, retention, who can access records, and future AI/third-party processing.
    Resolved 2026-05-04 in PR https://github.com/Stophoto/safeguard-hub/pull/9: added `privacy.html` and linked it from the shared footer plus the main dashboard, landing, sign-in, sign-up, and profile setup entry points.

15. **F-15: Retention/legal hold policy is missing.**
    Define retention and deletion/hold rules before production incident data accumulates.

16. **F-16: Browser hardening is limited on GitHub Pages.**
    Add CSP/referrer policy meta tags and avoid introducing new CDN scripts without SRI.
    Partially resolved 2026-05-04 in PR https://github.com/Stophoto/safeguard-hub/pull/9: CSP meta tags were added to every HTML page, React was vendored locally, SRI was added to Google Fonts stylesheet loads, and the inline cleanup inventory is documented in `docs/F-16-inline-audit.md`. Open follow-up: `unsafe-inline` remains until inline scripts/styles are extracted, and `frame-ancestors` needs real HTTP headers because browsers ignore it when delivered in a meta tag.

## Recommended Sequence

1. Remove client-readable shared secrets and sensitive fallback logging.
2. Harden Firestore rules for user profile field ownership and submission shape.
3. Add the `safeguard_lead` model and audit logging for suspected abuse reports.
4. Reduce localStorage PII, add timeout/sign-out cleanup, and add export warnings.
5. Deploy rules, then run the live penetration test with explicit approval and cleanup plan.
