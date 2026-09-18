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

## Phases 0 + 1 — COMMITTED `39a8334` on main (2026-09-08 23:59:23)

Verified 2026-09-17 (`git log`/`git status`): both phases below landed together in one commit,
"feat: web-app activation analytics + marketing site to v1.37.0", 162 files. `git status` is
clean — nothing from Phases 0–1 is sitting uncommitted. Treat every "staged, NOT committed" line
below as historical (accurate for about an hour on 2026-09-08, before the commit that same night).
Phase 2 (social proof / reviews) has not started as of 2026-09-17.

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

## Phase 2 — "Harvest social proof": repo side EXECUTED 2026-09-17, migration deployed dev+prod, nothing committed

- **Bug found + fixed:** both review-ask mechanisms — the hourly
  `private.create_review_nudge_notifications()` cron and the client
  `apps/mobile/src/hooks/useStoreReviewNudge.ts` hook — were firing on the auto-seeded example
  trip (`create-example-trip` sets `start_date` ~3 months out, so it eventually "ends" and both
  mechanisms treat it as real) and on guest accounts (`is_guest`, no store account to review
  from). Spent the ~3/year native iOS review-prompt budget on a fake trip, live in prod.
  Fixed by migration `20260917100000_review_nudge_exclude_example_and_guests.sql`
  (function-body replace, precedent `20260817100000_review_nudge_store_neutral.sql`: adds
  `AND is_example = false` to the trip loop, joins `public.users` + `AND u.is_guest = false` to
  the member loop) plus matching exclusions in `useStoreReviewNudge.ts`'s `eligible` predicate
  and an early guest bail-out. **Deployed to dev AND prod** (verified via `pg_get_functiondef` on
  both — bodies match the migration file exactly); migration + client land in one commit with
  the Tech Lead's approval, not yet committed.
- **New `npm run reviews:outreach`** (`scripts/review-outreach.mjs`, modelled on
  `scripts/analytics-report.mjs` — same `.env.production` / service-role-key setup, same
  gitignored `analytics-reports/` output) — lists real users (excludes `is_example` trips,
  `is_guest` users, anyone without an email) at a genuine success moment (a completed trip, via
  `trip_members` + `trips.end_date`, or a settled expense, via `expenses` + `expense_splits`
  `status = 'settled'`), flags anyone who already has a `review_nudge` notification so you don't
  double-ask, and includes EN/DE ask templates. Ran against prod 2026-09-17: 44 candidates, 8
  not yet app-nudged.
- **New `npm run ratings:sync`** (`scripts/fetch-store-ratings.mjs`) — App Store ratings are
  fetched live and free from the public, unauthenticated `itunes.apple.com/lookup?id=6800049398`
  endpoint across a handful of storefronts (Apple ratings are per-storefront — there's no single
  global number) and combined count-weighted. **Play Store has no public aggregate rating API** —
  the documented route is the Play Console's private per-app ratings CSVs (Cloud Storage bucket)
  or the Play Developer Reporting API, both needing a service-account key with Storage read
  access; `apps/mobile/eas.json` references `./play-store-service-account.json` for EAS submit
  but that file is **not present on this machine**, so Play automation isn't built — fill it by
  hand via `--play-rating=<v> --play-count=<n>` from Play Console → Ratings until a suitable key
  exists. Writes committed `marketing/site/store-ratings.json` (committed, not gitignored — the
  published number must always be visible in a git diff).
- **Verified live rating state (2026-09-17):** App Store DE storefront = 5.0 from 1 rating; US
  storefront = 0. Play Store unchecked. Nowhere near the 25-review gate.
- **`marketing/site/build.mjs`** reads `store-ratings.json` once (`STORE_RATINGS`,
  `RATING_SCHEMA_ELIGIBLE = combined.ratingCount >= REVIEW_SCHEMA_MIN` where
  `REVIEW_SCHEMA_MIN = 25`) and gates two things on it: `softwareApplicationLd()`'s
  `aggregateRating` block, and a homepage `#rating-proof` line in **both** hero sections
  (`docs/index.html` EN, `docs/de/index.html` DE via `renderGermanHome()` step 4c) — both pull
  the exact same values so the JSON-LD can never diverge from what a visitor sees (Pillar 4).
  Below threshold today: fully dormant — `npm run build:site` run 3× produces byte-identical
  `docs/index.html`/`docs/de/index.html` (md5-verified). `docs/index.html` got a permanent empty
  `<p id="rating-proof"></p>` scaffold hand-added to the hero (source file, not generated —
  see `marketing-site-build`) for `syncEnglishHomepageAppLd()` to populate later; CSS
  `.rating-proof:empty { display: none; }` keeps it invisible until then.
  `marketing/seo-strategy.md` Pillar 4 rewritten to document this pipeline (replacing the old
  "planned checklist" prose).
- To activate once 25+ is real: `npm run ratings:sync` (verify by eye against both consoles) →
  `npm run build:site` → visually check the homepage line → commit.
- Housekeeping: a background fork spawned mid-session to check live review counts kept running
  briefly after being stopped and left a duplicate stray `scripts/review-outreach-candidates.mjs`
  — deleted, not part of the real deliverable. Also corrected in this pass: the "Phase 0/1
  staged, NOT committed" language above was stale by about an hour on 2026-09-08 — see the note
  at the top of the Phase 0 section.

### Play Store ratings automation (set up 2026-09-17)

The real Play Console developer account is under **meetdeep.de@gmail.com**
(GCP project `vacationist`, number `632483929424`) — not whatever gcloud identity is active by
default on this machine (was `tdkiodok@gmail.com`; run
`gcloud auth login meetdeep.de@gmail.com` if that account isn't already credentialed —
`gcloud auth list` shows what's available). That project already has
`eas-play-store-builder@vacationist.iam.gserviceaccount.com` (broad EAS-submit permissions,
`apps/mobile/eas.json` — never reuse for read-only reporting) and `firebase-adminsdk-fbsvc@...`.

Created a **new, dedicated, zero-IAM-role** service account for this one job:
`play-ratings-reader@vacationist.iam.gserviceaccount.com` (confirmed via
`gcloud projects get-iam-policy vacationist --filter="bindings.members:play-ratings-reader"` →
no bindings — its only possible access is whatever Play Console itself grants by email invite,
not anything on the GCP project). Key downloaded to `play-ratings-service-account.json` at repo
root; `.gitignore` gained explicit entries for it and for the pre-existing
`play-store-service-account.json` (which had been kept out of git by discipline alone, no rule).

`scripts/fetch-store-ratings.mjs` now tries an automated Play fetch first: reads
`stats/ratings/ratings_com.vacationist.mobile_<yyyyMM>_overview.csv` from the developer's private
Cloud Storage bucket via `@google-cloud/storage` (new devDependency), tries the two most recent
months (the newest can be nearly-empty for the first few days of a month), parses the UTF-16LE
CSV **by header name** ("Total Average Rating" / "Total Average Rating Count" — Google's own docs
say never rely on column position), and throws with the raw header line rather than guessing if
those columns aren't found. Falls back to the pre-existing manual
`--play-rating=<v> --play-count=<n>` entry when the key file or bucket id isn't available.

**Both manual steps done 2026-09-17, but automation still not working — status:**
1. **Done and verified correct.** Play Console (account under **meetdeep.de@gmail.com** —
   switch to it in Chrome/gcloud if you land on the wrong Google identity; developer/account id
   `4871205259084418605`, which is also the bucket id) → Users and permissions →
   `play-ratings-reader@vacationist.iam.gserviceaccount.com` → **Account permissions** tab
   (not App permissions) → **"App-Informationen ansehen und Bulk-Berichte herunterladen
   (schreibgeschützt)"** ("View app information and download bulk reports (read only)") is
   checked. Verified directly via `mcp__claude-in-chrome` — this is not a guess.
2. **Done.** Bucket id: `pubsite_prod_4871205259084418605` (note: no `_rev_` segment — some
   accounts use the older `pubsite_prod_<id>` form, not `pubsite_prod_rev_<id>`).
3. **Still failing.** `npm run ratings:sync -- --play-bucket=pubsite_prod_4871205259084418605`
   gets `storage.objects.list` / `storage.objects.get` permission-denied — identically across
   4+ retries, including after the permission was independently confirmed correct via the
   browser. Read straight through: this is not a config problem, it's Play's backend
   propagation from its own permission system down to the actual bucket ACL being slow
   (community reports: up to ~24h for this specific legacy path). **Don't re-debug the
   permission grant — it's already right.** Just retry the same command later; the bucket id
   isn't cached in `store-ratings.json` yet (automated fetch has never succeeded), so pass
   `--play-bucket=` again when retrying.

**Stopgap in place:** real numbers filled in manually 2026-09-17 —
`--play-rating=4.9 --play-count=14` (Play), combined with App Store 5.0/1 → 4.91/15 combined.
Still 10 short of `REVIEW_SCHEMA_MIN` (25); confirmed the homepage build is still byte-identical
to the pre-numbers version (fully dormant, as designed).

**Unverified:** the CSV column-name assumptions in `parseRatingsOverviewCsv()` haven't been
checked against a real file yet (blocked on the propagation delay above) — if Google's actual
header text differs, the function throws loudly with the real header row rather than silently
producing a wrong number; fix the two regexes in that function to match once a real file is
finally readable.

## Phase 3 — Product Hunt: repo side PREPARED 2026-09-18, staged, NOT committed

**Operational doc: `marketing/product-hunt-launch.md`** (listing copy, first-comment draft, UTM
scheme, launch-day timeline in Swiss time, measurement caveats, Tech Lead manual checklist). Launch
gate is still **25 reviews** (15 combined on 2026-09-17) — launch is a single trigger once it clears.

- **Blocker found + fixed:** `trackFeatureEvent.ts` never forwarded `utm_*`, so `trip_created` /
  `invite_sent` / `invite_accepted` / `expense_added` were unattributed — a campaign was measurable
  only to `sign_up`. Now spreads `getWebAttribution()`; 7-test regression
  `trackFeatureEvent.test.ts` (mutation-checked: removing the fix fails exactly the 2 attribution
  tests). Client-only — no migration/Edge Function. **Must be deployed (push to `main` → Vercel)
  BEFORE launch day.**
- **`?ref=producthunt` correction:** PH appends it to outbound links itself (third-party-sourced,
  not PH docs); `track.js` / `webAttribution.ts` ignore `ref` and need `utm_source` or `rdt_cid`.
  Put `?utm_source=producthunt&utm_medium=launch&utm_campaign=ph-launch-2026` in the listing's
  website field; one campaign for the whole launch, a different `utm_source` per channel. Verified
  by running the real `track.js` in a Node stub (bare `?ref=` dropped, PH-appended `&ref=`
  harmless, first-touch holds).
- **PH forbids asking for upvotes** (may demote/remove the launch — PH help center). The older
  docs' "supporters who will upvote" lines are annotated as superseded; supporter DMs ask for
  feedback/comments.
- **Assets:** `npm run assets:producthunt` → 6 gallery cards 1270×760 + 240×240 thumbnail in
  `social-media/product-hunt/`; 60.00 s 1920×1080 silent demo MP4 from the committed generator
  `scripts/generate-producthunt-video.mjs` (ffmpeg is NOT a repo dep — run `ffmpeg-static` in a
  scratch dir, pass `--ffmpeg=<path>`). Shared `scripts/lib/phoneFrame.mjs` + `brandSvg.mjs`. PH
  video must be a full YouTube URL (no uploads); the tagline cap (~60 chars) is unverified, and the
  canonical 75-char tagline is too long — it goes in the first comment.
- **`npm run analytics:report -- --campaign=<name>`** scopes the report; "Top campaigns" gained a
  "Trips created" column. Numbers are a floor: consent-gated, web-app only (iOS installs are
  invisible after the store click).
- **Site freshness:** `APP_VERSION` 1.38.0 (18 `docs/` files, one line each, build idempotent).
  `play-store/listing.md` rewritten EN + DE (it predated offline/receipts/tickets/trip costs);
  `play-store/README.md` rewritten (it documented screenshot HTML mockups that no longer exist).
- **Placeholders only the Tech Lead can fill:** the founder origin story + one question in the first
  comment (deliberately not invented), and the "is it free forever?" wording (Pro is planned at
  ~500 MAU — a business commitment, not the doc's call).
- **Not verified:** the Chrome extension was not connected, so there was no real-browser / web-app
  end-to-end check of attribution — only the unit test + Node harness. The runbook ends with a
  Verification section for the Tech Lead to run once deployed.

See [[marketing-site-build]], [[marketing-v1-34-0-rollout]], [[reddit-ad-creatives]],
[[ios-app-store-rollout]], [[commit-discipline]], [[no-branches-main-only]].
