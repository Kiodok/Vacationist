---
name: marketing-growth-plan-q4-2026
description: Use before acting on anything in marketing/marketing-strategy.md or marketing/zero-budget-growth-plan.md (both are expired June 2026 research), or when asked "what's next for marketing" / "read the marketing folder and plan". Records the 2026-09-08 refresh, the current sequenced roadmap in marketing/growth-plan-2026-q4.md, and the verified current state (no Pro in code, no product-usage analytics, screenshots exist but unwired, site 3 releases stale).
---

# Marketing folder: state & Q4 2026 growth plan

On **2026-09-08** the `marketing/` folder was refreshed because its two big strategy docs
(`marketing-strategy.md`, `zero-budget-growth-plan.md`, both June 2026) had expired premises:
their central "ship iOS first, everything else is premature" blocker was resolved 2026-08-17, and
their economic model (15-day free tier, PostHog) never existed in the code.

Not committed — Tech Lead reviews and commits, per [[commit-discipline]]. Docs-only pass; no
`marketing/site/content/` touched, so `npm run build:site` twice produced zero `docs/` diff.

## What changed

- **NEW `marketing/growth-plan-2026-q4.md`** — the living roadmap. Current state + 5 sequenced
  phases + open Tech Lead decisions + an explicit "not doing until Pro exists" list.
- `zero-budget-growth-plan.md` — status header added; the 3 opening "fixes" struck. The
  week-by-week calendar is expired; the per-channel playbooks (Reddit, TikTok, LinkedIn,
  influencer, SEO article) and the leading-vs-lagging discipline are still good.
- `marketing-strategy.md` — status header; Executive Summary "critical blockers", "what must
  change immediately", and "3 most important decisions" annotated inline; competitor matrix
  `iOS ❌ Yet` → `✅`; §7 ASO "current state" marked unverified. Personas / competitor teardowns /
  keyword clusters / 200 content ideas left untouched — still the reference.
- `seo-strategy.md` — Pillar 7 cluster-5 first post marked shipped (it was, 2026-08-05); Pillar 8
  "blocked on assets" → "blocked on plumbing, assets exist"; next-priorities list revised
  (APP_VERSION drift is now #1).

## Verified current state (check before asserting the site is stale or a lever is available)

- **No Pro, no free tier, no paywall in code.** No `is_pro` / quota / RevenueCat in
  `apps/mobile`, `packages/`, `supabase/migrations`. Monetization = written spec only
  (`engineering/implementation_guide.md`). **⚠️ The live site copy already says Pro exists**
  (`features/expenses.md` "Pro adds more planning days per year", `vs/splitwise.md`,
  `blog/group-trip-receipts-and-expense-reports.md`, `docs/llms.txt`). This
  advertised-vs-real gap is flagged in the plan's open decisions, not fixed — it is a Tech Lead
  business-rule call. Any lever that needs something to *grant* (referral bonus days, free-Pro
  influencer barter) is inert until Pro ships.
- **PostHog not installed.** First-party funnel stack instead: `supabase/functions/track-event`
  → `public.analytics_events`, Reddit Pixel `a2_jcz7aqtl8eua` + CAPI
  (`supabase/functions/attribution-capi`), first-touch attribution in `marketing/site/track.js`
  (survives Android install referrer), local dashboard `npm run analytics:report`.
- **No product-usage analytics.** Event allowlist in `packages/types/src/analytics.ts` is
  marketing-site + store-click only. `logAnalyticsEvent` has one app call site
  (`StoreBadges.tsx`). `trip_created` / `invite_sent` / `invite_accepted` don't exist — the
  invite loop (the metric the zero-budget plan says matters most) is unmeasurable. Plan Phase 0.
- **Screenshots exist, wired into nothing.** `play-store/screenshots/` (16, Greece,
  Android + iOS 6.5in, from `scripts/generate-ios-screenshots.mjs`) and
  `social-media/reddit/ads/screenshot_barcelona_*.jpg` (9, 1080×2460, colorful theme). `docs/`
  has zero `<img>` tags. Plan Phase 1.
- **Site 3 releases behind.** `marketing/site/build.mjs` `APP_VERSION = '1.34.2'`; app is
  `1.37.0`. v1.37.0's 7-day offline mode (a real differentiator) is absent from the site.
- Done and current: iOS (v1.32.0, App Store `id6800049398`); SEO pipeline (77 HTML pages,
  bilingual, OG cards, RSS, JSON-LD, `llms.txt`); `docs/join.html` as a marketing page;
  Reddit Ads + attribution.

## Tech Lead decisions (resolved 2026-09-08)

- **Pro ships at ~500 MAU** (currently ~50–60, ~10× away). Levers needing something to grant stay
  parked. The site copy already asserting a current Pro tier / planning-day limit is premature →
  soften in Phase 1.
- **Listing name already done**: "Vacationist Group Trip Planner" (EN) / "Vacationist
  Gruppenreiseplaner" (DE), both stores. June ASO title recommendation is satisfied — don't
  re-propose it.
- **Product Hunt**: launching is free; ~$200–500 optional supporting spend. Timing after Phases 1–2.
- **Screenshots: Greece set** (`play-store/screenshots/`). Barcelona = Reddit ads only.

## Phase 0 — EXECUTED 2026-09-08 (dev + prod deployed; client staged, NOT committed)

Full plan: `~/.claude/plans/cosmic-booping-dewdrop.md`.

- **Web-app surface ONLY.** Helper `apps/mobile/src/utils/trackFeatureEvent.ts` (`src/utils/`, not
  `features/consent/` — sits with `exampleTrip.ts`): `Platform.OS==='web'` +
  `useConsentStore.decision==='granted'` + `logAnalyticsEvent({surface:'web_app'})`, mirrors
  `StoreBadges.tsx`. Events `trip_created` / `invite_sent` / `invite_accepted` / `expense_added`
  (+ `PRODUCT_FUNNEL_EVENT` const, `packages/types/src/analytics.ts`). Call sites: `useTrips.ts`
  `useCreateTrip.onSuccess`; `useInvites.ts` `useCreateInvite.onSuccess`; `join.tsx` +
  `join-confirm.tsx` after `redeemInviteToken`; `mutationDefaults.ts` `['createExpense']`
  onSuccess (NOT the hook — persisted).
- **Example-trip exclusion:** migration `20260908120000_add_trips_is_example.sql`
  (`trips.is_example BOOLEAN NOT NULL DEFAULT false` + backfill on seeded description);
  `create-example-trip/index.ts` sets `is_example: true`; `Trip` interface + `database.types.ts`
  regen'd; `apps/mobile/src/utils/exampleTrip.ts` `isCachedExampleTrip()`. `invite_sent` +
  `expense_added` pass `{isExampleTrip}`; `invite_accepted` best-effort no-check; `trip_created`
  N/A (server-side).
- **Events migration** `20260908130000_add_product_funnel_events.sql` (DROP+ADD
  `analytics_events_event_name_check`, template `20260817110000`) + `track-event` `EVENT_NAMES`.
  A future new `event_name` still needs all 3 synced by hand.
- **Deployed** both migrations + both Edge Functions to dev AND prod; ledger parity confirmed;
  curl-verified (new events → 204, bad origin → 403). `analytics-report.mjs` has an "Activation
  funnel (web app)" card. Privacy policy EN + DE updated (DE rebuilt via `npm run build:site`).
  `engineering/supabase.md` + `play_data_safety.md` logged. typecheck + tests green (196/13/187).
- **NOT committed** — staged, awaiting Tech Lead test/approval (migrations + client one commit).
## Phase 1 — EXECUTED 2026-09-08 (staged, NOT committed)

- `build.mjs` `APP_VERSION` → `1.37.0`; `APP_LD` refreshed; `DE_HOME_LASTMOD` + sitemap `/` &
  `/privacy-policy.html` lastmods → 2026-09-08; `FOOTER_LINKS` += `/features/offline/`.
- New `scripts/generate-web-screenshots.mjs` (`npm run screenshots:web`) → 8 WebP 720w in
  `docs/assets/img/`. Inline `<figure class="app-shot">` (new `site.css` rule) after the lede on
  `/features/{voting,expenses,analytics,transfers}/` EN+DE. `APP_SCREENSHOTS` const in `build.mjs`
  → `SoftwareApplication.screenshot`.
- **Homepage hero mockup KEPT** (deviation): bilingual + animated CSS phone; an English static
  screenshot would regress `/de/`. No `docs/index.html` markup / `docs/i18n` / `CACHE_VER` change.
- New `/features/offline/` EN+DE pair (model `transfers.md`; "at least 7 days with no connection").
- Pro copy removed across ~38 files (`/features/`, `/vs/`, `/alternatives/`, `/blog/`, 7
  `/use-cases/`, `docs/llms.txt`). Competitor Pro mentions left intact.
- `npm run build:site` idempotent; no new `[seo]` warnings; 153 files changed (footer link hits
  every generated page). Chrome spot-check blocked (extension not connected).

## Phase 5 — PLG sharing idea bank (added to the doc 2026-09-08, not scheduled)

`growth-plan-2026-q4.md` has a `## Phase 5` section (after Phase 4, before Measurement): a
brainstormed **idea bank**, explicitly not a fifth workstream, NOT committed. 5 features to let a
user share a trip link *outside* the travel group — the audience the invite loop never reaches
(today `/join?token=` only pulls people *in* as collaborators):

- **5.1 Public Trip Page** *(flagship, L)* — organizer toggles a read-only `share_token` →
  `vacationist.app/t/<token>` served by a **Vercel Function** rendering static HTML with real
  per-page OG tags. New anon `get_public_trip(p_share_token)` RPC modelled on `preview_invite_token`.
  Whitelisted projection only — no expenses/emails/docs/votes/notes/chat. Reuses
  `generateTripMarkdown()` aggregation + `og-image.mjs` card technique.
- **5.2 Highlight card → acquisition surface** *(S–M)* — add logo + QR to `HighlightCard.tsx`, pass
  `url` + `message` in `TripHighlightSheet.handleShare()` (image-only today), un-gate the web
  trigger in `overview.tsx`. Upgrades a share behavior already happening.
- **5.3 Post-trip Recap** *(M if 5.1 exists)* — recap as a mode of the 5.1 page + auto-composed
  Highlight card + a `guest_nudge`-style organizer prompt at `end_date`.
- **5.4 Join interstitial preview** *(S, cheapest)* — `docs/join.html` renders a widened
  `preview_invite_token` (add member/activity/accommodation counts, the ones `getTripInviteStats()`
  computes). One file + one additive RPC migration.
- **5.5 `.ics` calendar feed** *(M given 5.1)* — subscribable itinerary for non-travelers (partner,
  parents); rides 5.1's token + RPC + Function infra.
- **5.0 prerequisite** — share-link attribution, **web-only** (consistent with the Phase 0 web-only
  decision; the sharing surfaces are all browser-side anyway). Stamp links with sharer `user_id`,
  record on web redeem / public-view / sign-up = the K-factor signal.

Constraints the section records: no trip imagery exists anywhere (no `destination`/cover/photo
columns; only `avatars` is a public bucket); `web.vacationist.app` is un-shareable (`vercel.json`
`/(.*)`→`/index.html` rewrite + blanket `noindex`, single static `+html.tsx` head) so nice unfurls
need server-rendered HTML; anon writes need Edge rate-limiting not Turnstile; privacy-policy §2/§3
EN+DE update needed. 5 open Tech Lead questions (5.1 hosting approach, indexability, moderation of
public trip titles, an additive `trips.location` column, final event names). Full plan file:
`~/.claude/plans/magical-inventing-mango.md`.

## The plan's sequencing (why this order)

Product Hunt and the review campaign spend the same scarce resource (people who'll act for you)
and both convert better against a site that shows the product + a listing with reviews. So:
**0** instrument funnel → **1** wire screenshots + version bump + offline copy → **2** review
campaign, then `aggregateRating` JSON-LD (never estimate the count — Pillar 4) → **3** Product
Hunt → **4** compound (DACH paid iteration on trips-created not installs; write "Group Trip
Privacy 101"; scale `/use-cases/` only once Search Console shows the first 8 ranking).

## How to apply

- Before quoting `marketing-strategy.md` or `zero-budget-growth-plan.md` as current strategy —
  don't. Read `growth-plan-2026-q4.md` first; the older two are research/playbook only.
- Before saying "the marketing site doesn't mention feature X" — also check whether X is post-
  v1.34.2; the site is version-stale, not necessarily wrong about what shipped earlier.
- Before proposing a referral program, influencer Pro codes, or free-tier changes — confirm Pro
  shipped. It hadn't as of 2026-09-08.
- Marketing-site edits still follow [[marketing-site-build]]: source in `marketing/site/`,
  `npm run build:site` twice, never hand-edit `docs/`.

See [[marketing-site-build]], [[marketing-v1-34-0-rollout]], [[reddit-ad-creatives]],
[[ios-app-store-rollout]], [[commit-discipline]], [[no-branches-main-only]].
