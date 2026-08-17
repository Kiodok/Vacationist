---
name: phase10-website
description: Historical reference for Phase 10 (the original landing page build) — GitHub Pages static site in docs/, custom domain vacationist.app. Use for context on what was originally built before the July 2026 SEO pipeline (see marketing-site-build) layered on top.
---

# Phase 10: landing page (complete)

Phase 10 (Landing Page) is complete. Hosted on GitHub Pages from the `docs/` folder, custom domain `vacationist.app` via `docs/CNAME`.

**Why:** Marketing website to showcase the app, drive Play Store downloads, and fulfill Swiss legal requirements.

**Files created/modified:**
- `docs/index.html` — Full landing page (replaced `docs/home.html`). Sections: nav, hero with CSS phone mockup + floating chips, 6-feature grid, how-it-works 3-step, trust strip, download/QR section, footer.
- `docs/impressum.html` — Swiss Nebenerwerbstätigkeit impressum (Gary Lude, Switzerland, meetdeep.de@gmail.com).
- `docs/robots.txt` + `docs/sitemap.xml` — SEO.
- `docs/404.html` — Custom 404 matching brand.
- `docs/privacy-policy.html` — Fixed placeholder `[contact@yourdomain.com]` → `meetdeep.de@gmail.com`, added Inter font + back-nav.
- `docs/terms-of-service.html` — Added Inter font + back-nav.
- `docs/implementation_guide.md` — Updated Phase 10 checklist, removed Vercel/Firebase, documented GitHub Pages DNS setup.

**Key details:**
- Was Android (Google Play) only at launch; App Store badge showed "Coming Soon". Superseded 2026-08-17 by Phase 16 (iOS App Store rollout, see [[ios-app-store-rollout]]) — iOS shipped, badge is now a live App Store link.
- QR code generated inline with a self-contained JS Reed-Solomon encoder.
- `docs/CNAME` already contained `vacationist.app` before this phase.

**How to apply:** All marketing site files live in `docs/`; GitHub Pages auto-deploys on push to `main`. This phase predates the SEO content pipeline added in July 2026 — see [[marketing-site-build]] for the current authoring workflow (Markdown source → generated HTML), which now governs most of `docs/` except the hand-authored pages listed there.
