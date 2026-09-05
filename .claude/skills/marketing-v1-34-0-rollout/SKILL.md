---
name: marketing-v1-34-0-rollout
description: Use when asked whether vacationist.app reflects current app features, before re-auditing the marketing site for staleness, or when editing marketing copy about the business-cost flag, the business expense summary, the cross-trip Analytics tab / trip-cost card, per-item currency on bookings and transfers, multi-currency comparison claims, or public-transport passengers. Records the 2026-09-06 content pass that brought the site up to v1.34.2 and the accuracy rules it used.
---

# Marketing site: v1.34.0–v1.34.2 rollout (2026-09-06)

On 2026-09-06 the marketing site was brought current with v1.34.0 / v1.34.1 / v1.34.2. As of
writing it is **not committed** — the Tech Lead reviews and commits, per [[commit-discipline]].
Pushing `docs/` to `main` deploys the site live via GitHub Pages, so it waits.

**Why:** the three releases were already on `main` (`3a7c718`, `5cb0abb`, `d24fb0f`) but touched
only the privacy policy. The site still declared `APP_VERSION = '1.33.1'` and described the
business report as expense-only, had no surface for the new Analytics tab, and self-rated
multi-currency as "⚠️ Basic" — all now stale. Tech Lead approved a full sweep + a new
`/features/analytics/` page pair + an honest multi-currency re-rate.

## What was done (so a redo doesn't miss a step)

- `marketing/site/build.mjs`: `APP_VERSION` → `'1.34.2'`; `APP_LD.{en,de}.{description,
  featureList}` widened (cross-trip analytics, per-item currencies, "business cost" wording);
  `FOOTER_LINKS.{en,de}.product` += `/features/analytics/`; `DE_HOME_LASTMOD` and the
  `STATIC_SITEMAP_ENTRIES` `/` lastmod → `2026-09-06`.
- **New page pair** `marketing/site/content/{features,de/features}/analytics.md`. Modeled on
  `features/transfers.md` — **no `appLd`** (feature pages don't carry it; only use-case pages do).
  Bidirectional `altPath`, `<!--CTA-->`, `## Frequently asked questions` for FAQPage JSON-LD.
  Wired into both `features/index.md` (a 6th core-feature card), `features/expenses.md` +
  `features/transfers.md` `related:`, and the footer.
- Homepage: `docs/i18n/{en,de}.js` — `feat.2.desc`, `feat.8.desc`, `faq.7.a`. Mirrored the three
  into the hardcoded EN fallback in `docs/index.html`, **and** into the FAQPage JSON-LD block's
  `faq.7` answer there (that block is NOT rebuilt for EN — only `syncEnglishHomepageAppLd` runs at
  build time; `renderGermanHome()` rebuilds it for `/de/`). Bumped `CACHE_VER` in `docs/i18n.js`.
  **en.js / de.js key sets must stay identical** — verify (they held at 227/227).
- Business-cost sweep (EN + every DE twin): `features/expenses.md`,
  `use-cases/corporate-offsite-planner.md`, `blog/group-trip-receipts-and-expense-reports.md`,
  `features/index.md`, `use-cases/index.md`, `blog/how-to-split-travel-expenses.md`,
  `blog/best-group-travel-apps-2026.md`, all 5 `/vs/` tables, `/alternatives/splitwise/`,
  `docs/llms.txt`.

## Accuracy rules used (verified against the v1.34.x migrations + `packages/utils`)

- **"Business cost", not "business expense".** The flag is on expenses AND `accommodations` /
  `transfer_flights` / `transfer_rentals` / `transfer_public_transport` (NOT `transfer_vehicles` —
  it has no price column). `buildBusinessExpenseReport` merges all five with FX conversion and
  filters to **committed** items only (accommodations `reserved`/`booked`/`completed`; flights
  `booked`/`completed`). Report currency = `user.preferred_currency ?? trip.base_currency`.
  Receipt links valid **30 days**; Markdown+PDF on web, PDF-only on native — unchanged from v1.33.
- **Analytics tab** (labelled "Analytics" in-app, `app/(tabs)/costs.tsx`) shows the viewer's
  **own** cost share of every trip, grouped by year, in their preferred currency. "My share" is
  NOT `total ÷ members`: flights & public transport count only if the viewer is an assigned
  passenger OR ticket-holder; expenses use the viewer's real `expense_splits` debt;
  accommodation / rentals / activities split evenly. A category that has a priced entity
  **suppresses** its matching expense bucket — say "no double-counting". `manual` / `shopping`
  expenses always count. Currencies with no available rate are **excluded and flagged**, never
  counted as zero. `computeMyCostShares` and `computeTripCostSummary` must agree on that
  precedence — if you change one, change the other.
- **Trip Overview "Trip costs" card**: group total, ≈ per person, budget progress bar (fill
  clamps at 100%, % text stays unclamped, bar turns danger over budget).
- **Per-item currency**: every accommodation + flight + rental + public-transport row keeps its
  own currency, independent of later trip-currency changes; conversion uses **stored daily rates**
  (EUR-relative `public.exchange_rates`; cross-rate math in
  `packages/utils/src/currencyConversion.ts`). It is NOT historical or manual per-transaction
  rates — keep exactly one honest caveat to that effect in the Splitwise / Tricount comparisons,
  and do NOT claim outright multi-currency parity or a win. Re-rated the comparison rows
  `⚠️ Basic` → `✅ Per-item currencies, daily rates` on `/vs/{splitwise,tricount}/`,
  `/alternatives/splitwise/`, `blog/best-group-travel-apps-2026` (+ DE). Left competitors' own
  capability claims untouched (last verified 2026-09-03 — re-verify before leaning on them).
- **Public transport now HAS passenger assignment** (join/leave, like own cars — shipped v1.34.1).
  This kills the "no passenger assignment" line in [[marketing-v1-33-0-rollout]] (now corrected
  there). PT still has **no voting** — only flights vote. That part is unchanged.
- **Web push is deliberately NOT a marketing feature.** `web.vacationist.app` is noindexed and is
  not an SEO surface. The only thing v1.34.0's web push needed on the marketing side was the
  privacy-policy disclosure, which already shipped in `3a7c718` (EN html + DE markdown). `llms.txt`
  got a single "also delivered as web push in the browser" clause under Notifications — nothing
  more.
- No Pro gating on any v1.34.x feature — "free, no ads" framing holds.

## How to apply

- **Before claiming the site is stale for v1.34.x, assume this pass is done.** Check for a
  `/features/analytics/` page, "business cost" (not "business expense") wording on
  `features/expenses.md` + `corporate-offsite-planner.md`, and `✅ Per-item currencies` in the
  `/vs/tricount/` and `/vs/splitwise/` tables before re-auditing.
- After any content `.md` or `.css` edit: `npm run build:site` **twice** — the second run must
  produce zero content diff (the repo has CRLF-normalization noise; compare with
  `git -c core.autocrlf=false diff --ignore-cr-at-eol`). Then `npm run serve:docs` (port 3001)
  and click through `/`, `/de/`, `/features/analytics/`, `/de/features/analytics/`,
  `/vs/tricount/`, `/blog/`. Commit source + generated `docs/` together, after Tech Lead approval.

See [[marketing-site-build]] for the pipeline, [[marketing-v1-33-0-rollout]] for the prior pass,
[[v1-34-0-batch]] / [[v1-34-1-batch]] / [[v1-34-2-batch]] for the app-side releases,
[[commit-discipline]] and [[no-branches-main-only]] for the git rules.
