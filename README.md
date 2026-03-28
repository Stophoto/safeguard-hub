# Safeguard Hub — SG-HUB-001

The operational interface for the Safeguard Framework — a child and vulnerable adult protection system for church environments.

## What This Is

A single-page web application that serves as the admin dashboard for the Safeguard Framework. It provides:

- **Document Map** — Every policy, SOP, form, and training module in the framework, organized by layer
- **Admin Tasks** — The Safeguard Coordinator's weekly, monthly, quarterly, and annual rhythm
- **Fillable Forms** — Digital forms that submit directly to Google Sheets:
  - SG-FRM-001 — Ministry Application (→ People tab)
  - SG-FRM-006 — Incident / Accident Report (→ Incidents tab)
  - SG-FRM-012 — Training Completion Record (→ Training Log tab)

## Setup

### 1. Google Cloud (one-time, ~15 minutes)

1. Create a Google Cloud project
2. Enable the Google Sheets API
3. Create a service account and download the JSON key file
4. Create a Google Sheets workbook with three tabs: **People**, **Incidents**, **Training Log**
5. Share the workbook with the service account email (Editor access)

### 2. Hub Configuration (one-time per browser)

Open the Hub in your browser. On first load, you'll see a setup screen. Paste:

- Your **Workbook ID** (the long string from the Google Sheets URL, between `/d/` and `/edit`)
- The **full contents** of your downloaded JSON key file

Your credentials are stored in your browser's localStorage. They never leave your device and are not included in this repository.

### 3. Hosting

This Hub is designed to be hosted on GitHub Pages:

1. Fork or clone this repository
2. In repository Settings → Pages, set source to "Deploy from a branch" → `main` → `/ (root)`
3. Your Hub will be available at `https://yourusername.github.io/safeguard-hub/`

It also works opened directly as a local file.

## For Other Churches

To adopt this Hub for your own church:

1. Clone this repository
2. Complete the Google Cloud setup (step 1 above)
3. Open the Hub and enter your own credentials
4. Optionally edit the church name in `index.html`

The framework documents themselves are maintained separately. This Hub is the operational interface.

## Architecture

- **Zero infrastructure.** No server, no database, no backend. Everything runs in the browser.
- **Google Sheets as database.** Form submissions write directly to Sheets via the Google Sheets API using service account JWT authentication.
- **Single file.** The entire application is one `index.html` file — React, the Sheets integration, and all three forms.
- **Credentials in localStorage.** Private keys never touch the repository.

## Security Notes

- The service account only has access to the specific spreadsheet you share it with
- Credentials stored in localStorage are scoped to the browser and origin
- This is designed for a small admin tool with a handful of trusted users, not a public-facing application
- To reset credentials: click "Reset Credentials" in the Hub footer, or run `localStorage.removeItem('sg_hub_config')` in the browser console

## Document Map

32 documents across 5 layers. See SG-DOCMAP-001 for the complete registry.

---

*Safeguard Framework — Built for Bethany Chapel*
