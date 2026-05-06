# Safeguard Hub — SG-HUB-001

The operational interface for the Safeguard Framework — a child and vulnerable adult protection system for church environments.

## What This Is

A static GitHub Pages app backed by Firebase Auth and Firestore. It serves as the operational workspace for the Safeguard Framework:

- **Volunteer dashboard** — shows each volunteer their onboarding status and next required steps
- **Document map** — policies, SOPs, forms, and training modules organized by framework layer
- **Coordinator admin** — people roster, screening tracker, form submissions, task rhythm, and classroom print kit
- **Fillable workflows** — applications, incidents, abuse reports, references, covenant signing, police-check status, and training progress
- **Safeguard Lead area** — suspected abuse reports are separated from ordinary coordinator submissions

## Setup

### 1. Firebase

1. Create or use the Firebase project for the Hub.
2. Enable Firebase Authentication with email/password sign-in.
3. Enable Firestore.
4. Review and publish `firestore.rules` only after explicit approval.
5. Bootstrap the first Coordinator/Safeguard Lead Admin using the approved project-owner process.

### 2. Hosting

This Hub is designed to be hosted on GitHub Pages:

1. Fork or clone this repository
2. In repository Settings → Pages, set source to "Deploy from a branch" → `main` → `/ (root)`
3. Your Hub will be available at `https://yourusername.github.io/safeguard-hub/`

Some static document pages can be opened locally, but authenticated workflows expect the GitHub Pages origin and configured Firebase project.

## For Other Churches

To adopt this Hub for your own church:

1. Clone this repository.
2. Create your own Firebase project and update `sg-firebase.js`.
3. Review policies, privacy wording, retention rules, and contact details for your jurisdiction/church.
4. Publish the static site to your chosen hosting provider.

The framework documents themselves are maintained separately. This Hub is the operational interface.

## Architecture

- **Static frontend.** The app is served as HTML/CSS/JS from GitHub Pages.
- **Firebase Auth.** Users sign in with email/password and must verify email before using protected workflows.
- **Firestore records.** Profiles, invites, submissions, abuse reports, and compliance state are stored in Firestore.
- **Flat page structure.** The project currently uses standalone HTML pages plus shared helper modules such as `sg-auth.js`, `sg-profile.js`, `sg-admin.js`, and `sg-submissions.js`.

## Security Notes

- Do not deploy rules, modify Firebase data, or change production configuration without explicit approval.
- Suspected abuse reports are intentionally more sensitive than ordinary submissions.
- Phase A does not yet provide durable server-backed read audit logs for abuse reports.
- Before real volunteer launch, complete the remaining security backlog in `SECURITY_REVIEW.md`, especially audit logging, idle timeout/shared-device cleanup, and stronger role enforcement.

## Document Map

32 documents across 5 layers. See SG-DOCMAP-001 for the complete registry.

---

*Safeguard Framework — Built for Bethany Chapel*
