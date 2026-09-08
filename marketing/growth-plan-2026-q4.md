# Vacationist — Growth Plan, Q4 2026

*Living document. Supersedes the week-by-week calendar in `zero-budget-growth-plan.md` (expired ~June–Sept 2026) and the conclusions of `marketing-strategy.md` (June 2026). Both of those remain useful as research and channel playbooks — see "How the older docs relate" at the bottom.*

**Last updated:** 2026-09-08

---

## Current state (September 2026)

### What has shipped since the June 2026 strategy docs

| Area | Status |
|---|---|
| **iOS app** | Live on the App Store since v1.32.0 (2026-08-17). `id6800049398`. The June docs' single hard prerequisite ("everything else is premature" without it) is **done**. |
| **Marketing site / SEO** | Built out: **77 HTML pages**, EN + DE, bidirectional hreflang, generated per-page OG cards, blog RSS, `SoftwareApplication` / `Organization` / `FAQPage` / `BreadcrumbList` JSON-LD, `llms.txt` for GEO. See `seo-strategy.md` — that is the living reference for search. |
| **Invite / join page** | `docs/join.html` is already a marketing page: feature grid, dual store badges, "plan your own trip" CTA, consent-gated click tracking. The June docs' "rebuild the join page as a marketing moment" is largely done. |
| **Paid channel (DACH / Reddit)** | Reddit Ads running with a first-party attribution stack: Reddit Pixel (`a2_jcz7aqtl8eua`) + server-side Conversions API (`supabase/functions/attribution-capi`), first-touch UTM/`rdt_cid` capture that survives the Android install referrer (`marketing/site/track.js`), and a local funnel dashboard (`npm run analytics:report`). Two video creatives + thumbnail sets in `social-media/reddit/ads/`. Pipeline documented in `.claude/skills/reddit-ad-creatives/SKILL.md`. |
| **Real screenshots** | **25 real device captures exist in-repo** — `play-store/screenshots/` (16: Greece dataset, Android + iOS 6.5in) and `social-media/reddit/ads/screenshot_barcelona_*.jpg` (9, 1080×2460, colorful theme). |
| **Swiss print** | DIN A4 flyer generator `marketing/flyer/build-flyer.mjs` (QR → `vacationist.app/scan/android-qr`). |

### What the June docs assume that is not true

- **There is no free tier and no Pro.** No `is_pro`, no day quota, no RevenueCat, no paywall anywhere in the codebase. Monetization is a written spec only (`engineering/implementation_guide.md` §Monetization). The app is 100% free with zero revenue. Every recommendation built on "loosen the 15-day free tier", "give influencers free Pro", or "referral = +7 bonus days" is **inert until Pro ships**.
- **PostHog is not installed** and is not the plan. The first-party funnel stack above is what exists.

### The two real gaps right now

1. **No product-usage analytics.** The event allowlist (`packages/types/src/analytics.ts`) covers marketing-site and store-click events only: `page_visit`, `play_store_click`, `app_store_click`, `web_app_click`, `app_store_interest`, `sign_up`. Nothing records `trip_created`, `invite_sent`, `invite_accepted`, `expense_added`. `logAnalyticsEvent` has exactly one call site in the app (`StoreBadges.tsx`). **The invite loop — the one metric the zero-budget plan says matters most — is currently unmeasurable.**
2. **The marketing site is 3 releases stale.** `marketing/site/build.mjs` pins `APP_VERSION = '1.34.2'`; the app is `1.37.0`. v1.35.0 (Nudge on web, Zero-Tap Sign-In), v1.36.0 (stability), and especially **v1.37.0 (7-day offline mode)** are marketable and absent from the site. Offline-first is already in the competitor matrix as a Vacationist-only ✅.

---

## The four workstreams, sequenced

All four are active priorities. They are **not** parallel: Product Hunt and the review campaign both spend the same scarce resource (people willing to act on your behalf), and both convert far better against a site that shows the product and a store listing that already has reviews. Sequence:

*(`Phase 5` below is a separate thing — a backlog of product-led-growth feature ideas, not a fifth sequenced workstream. It's parked there so the idea bank lives next to the plan.)*

### Phase 0 — Instrument the product funnel  *(repo work, ~half a day)*

Add `trip_created`, `invite_sent`, `invite_accepted`, `expense_added` (names TBD) to the existing pipeline:
- `packages/types/src/analytics.ts` — `ANALYTICS_EVENT_NAME` + schema
- `supabase/functions/track-event/index.ts` — `EVENT_NAMES` set
- DB CHECK constraint — new migration (the allowlist is enforced in 3 places, kept in sync by hand)
- App call sites — the mutation `onSuccess` for trip create, invite generate, invite accept, expense add. Consent-gated via `useConsentStore`, surface `native_app`.
- Note the known constraint (`engineering/play_data_safety.md`): `track-event`'s origin allowlist rejects originless native requests today. Resolve that (allow an app auth header / dedicated native path) as part of this phase or the events go nowhere.

**Why first:** every downstream decision — did Product Hunt work, is the invite loop self-sustaining, which Reddit creative drives real trips not just installs — is guesswork without it.

### Phase 1 — Dress the shop window  *(repo work, ~1 day)*

1. **Wire the real screenshots into the marketing site.** Use the **Greece set** (`play-store/screenshots/` — matches the live store listings). `docs/` has zero `<img>` tags today; the homepage phone is pure CSS. Add real product screenshots to the homepage hero and each `/features/*` page. Conventions (naming, alt-text formula, `ImageObject` + `SoftwareApplication.screenshot` JSON-LD) are already written in `seo-strategy.md` Pillar 8 and become directly executable.
2. **Catch `APP_VERSION` up to 1.37.0** in `build.mjs` and refresh `featureList` / descriptions across `appLd` pages + homepage. Follow the process in `.claude/skills/marketing-v1-34-0-rollout/SKILL.md`.
3. **Give offline mode real copy** — a `/features/` entry or a homepage block. "Works for a week with no signal" is a concrete differentiator no competitor has.
4. **Soften the premature Pro copy** (see Decision 1) — Pro is ~10× MAU away; the site shouldn't state it as a current tier yet.

**Why here:** cheap, unblocks the deferred `SoftwareApplication.screenshot` schema, and lifts conversion on *every* channel at once — paid, organic, and Product Hunt all land on the same pages.

### Phase 2 — Harvest social proof  *(founder time + small repo follow-up)*

- Direct personal asks to the users onboarded so far — after a real moment (first trip planned, first expense settled), not a random prompt. Target 25+ reviews across both stores.
- In-app review prompt at a success moment if not already present (check `apps/mobile/src/features` for an existing rating nudge — Phase 16 added a native review flow per `ios-app-store-rollout` skill).
- **Once the count is real and verifiable in the console:** add `aggregateRating` to the `SoftwareApplication` JSON-LD. `seo-strategy.md` Pillar 4 specifies the exact shape and warns — never estimate or round the number; it must match the store exactly.

**Why here:** 25 reviews is a documented threshold, not a gradient. Product Hunt traffic converts materially better against a listing that clears it.

### Phase 3 — Product Hunt launch  *(founder time, 1 prep week + launch day)*

The spike event the June docs gated on iOS. Now unblocked.
- Assets: 60-second demo video, 5 screenshots (from Phase 1), tagline ("The group trip planner that replaces Splitwise + Wanderlog + WhatsApp polls"), pre-written first comment, 20 supporters lined up individually.
- Launch Tue/Wed/Thu, 12:01 AM PST. Founder available all day to reply.
- Wire a `?ref=producthunt` UTM so Phase 0's events attribute the spike.

**Why after 1–2:** the landing page shows the product and the store listing has reviews — the traffic has somewhere good to land.

### Phase 4 — Compound  *(continuous, mixed)*

- **DACH paid iteration.** More Reddit creatives + variants (the pipeline is documented and cheap to run). Read `npm run analytics:report` weekly; judge creatives on trips created, not installs, once Phase 0 lands. Small budget, Reddit-focused.
- **Close cluster 5.** `seo-strategy.md` Pillar 7's first privacy post *shipped* (`blog/travel-document-safety-guide.md`, 2026-08-05). The genuinely-unwritten one is *"Group Trip Privacy 101"* — write it EN + DE.
- **Scale `/use-cases/` — only when earned.** Pillar 5 forbids adding a 7th niche before the first 8 show ranking movement in Search Console (~6–8 weeks post-index). Check first.
- **Organic founder channels** (Reddit value-first, one LinkedIn "why I built this", TikTok if there's appetite) — the `zero-budget-growth-plan.md` playbooks still apply verbatim; only its calendar expired.

---

## Phase 5 — Product-led sharing features *(idea bank, not scheduled)*

*Added 2026-09-08. A brainstorm of 5 features that would give a user a genuine reason to send their
trip link to people **outside** the travel group — the audience the invite loop never reaches today.
Not committed to. The Tech Lead will decide if/when any of these gets built, in a separate session;
each would then follow the normal layer build order.*

### The gap these address

Every doc in `marketing/` converges on the invite loop as the growth lever, but today it only works
*inward*: `vacationist.app/join?token=…` is built to pull people **into** a trip as collaborators.
There is no surface for sharing a trip with people who won't collaborate — parents who want to see the
plan, a partner tracking your dates, friends you're bragging to, an audience. Those are the
highest-volume, lowest-friction shares and right now they're dead-ends:

- **No public read surface.** The only anon entry point is `/join?token=`, and it immediately forces
  an anonymous-account signup. `preview_invite_token` (anon `SECURITY DEFINER` RPC,
  `supabase/migrations/20260706110000_invite_token_preview_rpc.sql`) exposes only `{title, start_date, end_date}`.
- **The join interstitial shows nothing.** `docs/join.html` holds the token but never renders a
  preview, though `preview_invite_token` is anon-callable and `getTripInviteStats()` already computes
  member / activity / accommodation counts.
- **The shareable Highlight card is a dead end.** `HighlightCard.tsx` renders a text-only "Powered by
  Vacationist" — no logo, no URL, no QR. The share sheet passes the PNG with **no link or text**. It's
  also native-only. Every IG-story view of it is an unattributable, un-actionable impression.
- **No post-trip surface at all** — `marketing-strategy.md` §10.6 flags the missing post-trip loop as
  a retention *and* acquisition gap (vs. Polarsteps). The only touch after `end_date` is the
  `guest_nudge` cron (`20260616110000_create_guest_nudge_cron.sql`) — a plain notification.
- **No referral incentive is possible.** No Pro tier exists, so "invite a friend → bonus days" is
  inert (see "explicitly not doing" below). Every idea here must be **intrinsically** motivated —
  pride, convenience, keeping family informed — not a reward.

### Constraints every idea inherits

- **No trip imagery exists.** No `destination` / `location` column, no cover image, no photo field on
  activities or accommodations. Only `avatars` is a public bucket. "Beautiful" has to come from
  typography + layout + generated art, the way `marketing/site/og-image.mjs` already builds branded
  cards without photography.
- **`web.vacationist.app` is structurally un-shareable.** `vercel.json` rewrites `/(.*)` →
  `/index.html` and sets a blanket `X-Robots-Tag: noindex`; `apps/mobile/app/+html.tsx` is one static
  `<head>` for every route. Social scrapers don't run JS, so a client-rendered page unfurls as a
  generic empty card. Any "nice link unfurl" needs **server-rendered HTML with per-page OG tags** — a
  Vercel Function or a build-time generated page, not the SPA.
- **Anon write paths need Edge-Function rate limiting**, not Turnstile (which is bound to Supabase auth
  endpoints). Precedent: `check_invite_rate_limit()` in
  `20260511000004_invite_rate_limit_and_tighten_self_insert.sql`.
- **Privacy-policy update is a required deliverable** for anything that exposes trip content
  unauthenticated — `docs/privacy-policy.html` §2 "Trip & Planning Data" + §3, EN **and** DE.

### Reusable building blocks (found 2026-09-08)

| Asset | Path | Use |
|---|---|---|
| Anon `SECURITY DEFINER` RPC pattern | `preview_invite_token` in `20260706110000_…sql` | Template for any anon-safe trip read: token-gated, `SET search_path = ''`, `GRANT … TO anon`, whitelisted projection, empty set on failure. |
| Full itinerary aggregation | `generateTripMarkdown()` in `@vacationist/utils`, via `apps/mobile/src/features/sharing/hooks/useTripExport.ts` | The one place that merges activities + accommodations + flights/vehicles/rentals + lists + notes. Refactor the merge into a shared util. |
| Branded card generator | `marketing/site/og-image.mjs` | Same SVG→PNG technique makes a per-trip social card with no photography. |
| Highlight feature | `apps/mobile/src/features/sharing/` (`HighlightCard.tsx`, `highlightSelection.ts` slot-budget engine, `useTripHighlightData.ts`) | 5.2 edits this in place. |
| Invite tokens table | `invite_tokens` (`20260511000002_…sql`) — `token`, `expires_at`, `revoked_at`, `max_uses`, `use_count` | A separate read-only `share_tokens` mirrors this shape. |
| Blind interstitial | `docs/join.html` (GitHub Pages, serves real HTML, `noindex`) | 5.4 is entirely inside this file + a widened RPC. |
| Per-user device-calendar add | `apps/mobile/app/trip/[id]/overview.tsx` "add to device calendar" | Seed of 5.5 (one-time local dump → subscribable feed). |
| Analytics pipeline (3 hand-synced places) | `packages/types/src/analytics.ts` / `supabase/functions/track-event/index.ts` / DB `CHECK` on `analytics_events` | 5.0 prerequisite. Native `fetch` is 403'd by the origin allowlist today. |

---

### 5.0 — Prerequisite: share-link attribution

**None of 5.1–5.5 can be judged without this**, and Phase 0 already lists it first. Minimum:

1. Add product-usage events to the allowlist in **all 3 hand-synced places**: `trip_created`,
   `share_link_created`, `share_link_viewed`, `invite_accepted` (names align with Phase 0 Decision 5,
   still TBD).
2. **Measurable surface is web only** — consistent with the Phase 0 web-only decision (native
   `track-event` is 403'd for originless requests, native has no consent mechanism, and the privacy
   policy + "no tracking" marketing forbid native analytics). The good news: the *sharing* surfaces
   are inherently web — the public page view (5.1/5.3), the `.ics` fetch (5.5), the join interstitial
   (5.4), and the web-app redeem all fire from a browser where consent + `Origin` exist. Attribution
   is captured there, not from the native app.
3. Stamp every share / invite link with the sharer's `user_id`; record it on the web redeem path /
   the public-view RPC / sign-up so a new account traces back to the link that brought it. This is the
   K-factor signal `zero-budget-growth-plan.md` calls "the milestone that actually matters most".
4. Extend `scripts/analytics-report.mjs` with a share-funnel section.

All event calls stay gated on `useConsentStore` decision === `'granted'` and `Platform.OS === 'web'`,
matching the one existing call site (`apps/mobile/src/components/StoreBadges.tsx`).

---

### 5.1 — Public Trip Page (shareable read-only itinerary) — *flagship*

**Mechanic.** A second, distinct share mode alongside the collaborate-invite. In trip Settings the
organizer flips "Share a public view" → a read-only `share_token` is minted (never grants
membership). The link is `vacationist.app/t/<token>`, served by a **Vercel Function that renders
static HTML** with real per-page OG tags (`og:title` = trip name, `og:image` = a generated card,
`og:description` = dates + day count). The page shows a clean day-by-day itinerary: winning activities
(exclude `group_blocker`, as the calendar tab already does), accommodation names + check-in/out,
flights as `DEP → ARR`. It shows **nothing sensitive**: no expenses, no member emails (first names
only, opt-in), no documents, no votes, no notes, no chat. Two CTAs: "Plan your own trip — free"
(store/web links, UTM-stamped) and, if collaboration is also enabled, "Ask [name] to add you".

**Why it drives out-of-group sharing.** This is the exact scenario in the brief — a beautiful public
itinerary sent to family. A parent, partner, or friend who just wants to *see* the plan currently has
to install the app and create an anonymous account. Give them a link that unfurls well in
WhatsApp / iMessage / email and the organizer sends it proudly and widely. Every open is a branded
impression carrying a "make your own" CTA; a fraction of viewers become organizers. It's also the
first genuinely indexable Vacationist product content (opt-in per trip) — a long-tail SEO surface of
real itineraries.

**Builds on.** `preview_invite_token` RPC pattern → new `get_public_trip(p_share_token)` returning the
whitelisted projection. `generateTripMarkdown()`'s aggregation → refactored into a shared
`@vacationist/utils` function both the `.md` export and the RPC/renderer call. `og-image.mjs` card
technique → per-trip card.

**Gaps to close.** New read-only `share_tokens` table (mirror `invite_tokens`: revocable, no expiry
needed). New `SET search_path = ''` anon RPC. A Vercel Function project — `vercel.json` currently has
`framework: null` + a custom `buildCommand`, so this needs a config decision (see Open questions).
Edge rate-limit by token + IP hash. Settings UI + `sharing` i18n (EN/DE). Privacy-policy update.
Optional but recommended: a freetext `trips.location` column — `timezone` is a Europe-only enum shown
as `.replace('Europe/','')`, too weak to headline a page.

**Effort.** L. The migration + RPC + Settings toggle is M; the SSR function + OG card + hardening is
the bulk.

**Risks.** (a) Vercel Function wiring against the non-standard `vercel.json` needs proving out.
(b) Moderation — public, potentially indexable, user-authored trip titles/descriptions; needs a
report link + takedown path, and probably staying `noindex` until opt-in + a spot-check exists.
(c) Scope discipline — easy to balloon into "trip website builder".

---

### 5.2 — Turn the Highlight card into an acquisition surface

**Mechanic.** Three changes to the already-shipped Highlight feature (`apps/mobile/src/features/sharing/`):

1. **Add a scannable path back.** Put a small Vacationist logo lockup + a QR code (or short-URL
   caption) on `HighlightCard.tsx`. The QR points at the trip's Public Trip Page (5.1) if enabled,
   else a generic `vacationist.app/?ref=highlight` with UTM.
2. **Share the link, not just the pixels.** `TripHighlightSheet.handleShare()` passes only the image
   URI today — also pass `message` + `url` (native `Share.share({ message, url })`; web copies the URL
   alongside the download).
3. **Un-gate web.** The trigger in `overview.tsx` is `Platform.OS !== 'web'`-gated; the web branch of
   `handleShare` already exists.

**Why it drives out-of-group sharing.** People *already* post trip recaps to IG stories and send them
to family — the 9:16 "story" format exists for exactly this. Right now that's a wasted impression: no
viewer can act on it. A QR + logo turns every story view and every forwarded image into a
discoverable, attributable path. Zero new user behavior required.

**Builds on.** In-place edits to `HighlightCard.tsx`, `TripHighlightSheet.tsx`, `sharing` i18n. A QR
needs a lib (or render server-side alongside the 5.1 card). `highlightSelection.ts` slot budget may
need a small tweak to reserve footer space.

**Effort.** S–M. Ships independently with a generic UTM link; better once 5.1 exists.

**Risks.** QR contrast needs testing across all four theme modes (CLAUDE.md 🟡 rule). Minor: don't let
the footer crowd an already-dense square-format card.

---

### 5.3 — Post-Trip Recap page + a prompt to share it

**Mechanic.** When `end_date` passes, generate a **Recap** — where you went, "8 activities · 3 places ·
6 days · 5 friends", the itinerary as it actually happened, the group. Delivered as (a) a mode of the
5.1 Public Trip Page (`/t/<token>?recap=1`) and (b) an auto-composed Highlight card. The `guest_nudge`
cron gets a sibling: a notification to the **organizer** at trip end — "Your Croatia trip is done.
Share the recap." — with a one-tap share.

**Why it drives out-of-group sharing.** Recaps are the single most naturally-shared category of travel
content — Polarsteps' whole model, and `marketing-strategy.md` §10.6 flags the missing post-trip loop
as a major gap. "Here's how our trip went" sent to family after the fact has near-zero friction (the
trip's over, nobody has to do anything). Emotional, not utilitarian — which is what spreads. Bonus: a
real reason to re-open the app post-trip, of which there is currently none.

**Builds on.** 5.1's infra (RPC + SSR function + card). The `guest_nudge` cron
(`20260616110000_…sql`) is the exact pattern for the organizer prompt. `useTripHighlightData.ts`
auto-pick logic composes the card with no user input.

**Effort.** M *if 5.1 exists* (a projection variant + a cron + a notification type + copy). L standalone.

**Risks.** Without photos the recap leans on stats + typography — needs design proof it lands as
"memory" not "spreadsheet". Prompt tone / timing (don't nag).

---

### 5.4 — Make the join interstitial show the trip *(cheapest win)*

**Mechanic.** `docs/join.html` already has the token and runs JS against Supabase. Call
`preview_invite_token` — widened (additive, backwards-compatible) to also return `member_count` and
non-deleted activity / accommodation counts (the numbers `getTripInviteStats()` already computes) —
and render a real preview above the Join button: trip title, date range, "5 people already planning",
"12 activities to vote on". Keep the existing deep-link / store-button / browser-fallback logic.

**Why it drives out-of-group sharing.** Partly invite-conversion (a warm preview converts better than
a blind "Join Trip" button — `zero-budget-growth-plan.md` Action 2, half-done). But it also lowers the
organizer's hesitation to send the link *widely*: today it lands on a context-free page that could be
anything; a link that previews the actual trip and showcases the app is one a user will forward to the
group chat, the family thread, the coworker who might come.

**Builds on.** One file (`docs/join.html`) + one additive RPC-widening migration (existing
`preview_invite_token` callers ignore new columns). No Vercel Function, no new table, no app build.

**Effort.** S — genuinely a day.

**Risks.** Minimal. The widened projection must stay strictly non-sensitive (counts + title only — no
member names, no itinerary detail on a link that hasn't been accepted). `docs/join.html` stays `noindex`.

---

### 5.5 — Subscribable itinerary calendar feed (.ics)

**Mechanic.** Per trip, an opt-in `webcal://` / `https` **`.ics` feed** at a token URL, served by a
Vercel Function: all-day events for the trip span, timed events for flights and activities with times.
"Add our itinerary to your calendar" produces a link a non-traveler subscribes to; it stays live and
updates as the plan changes.

**Why it drives out-of-group sharing.** The audience is explicitly *not* the travel group — it's the
people who want to know when you're away and when your flight lands: a partner, parents, a housemate.
Each subscription is a standing, recurring brand touch (entries read "via Vacationist"). TripIt's
calendar sync is named in `marketing-strategy.md` §2 as a competitor advantage Vacationist lacks. The
per-user "add to device calendar" in `overview.tsx` is the seed — this makes it a shareable, living
feed instead of a one-time local dump for members only.

**Builds on.** 5.1's token + anon-RPC + Vercel Function infra (the `.ics` is a different response
content-type over the same `get_public_trip` projection). Whatever date/time formatting the
device-calendar export already uses.

**Effort.** M given 5.1's infra; the ICS generation itself is small (RFC 5545).

**Risks.** Narrower appeal than 5.1–5.3 — a "nice to have" a subset will love, not a broad viral
surface. Timezone correctness matters (`hermes-intl-timezone-gap` skill — use `dayjs.utc()` for plain
dates). Do last.

---

### Suggested sequencing, if pursued

| Order | Item | Rationale |
|---|---|---|
| 0 | **5.0 attribution** | Blocking. Without it every idea ships blind. Half a day, overlaps Phase 0. |
| 1 | **5.4 — join interstitial preview** | S, no new infra, immediate conversion lift. |
| 2 | **5.2 — Highlight card acquisition surface** | S–M, in-place edits, upgrades a behavior already happening. |
| 3 | **5.1 — Public Trip Page** | The flagship. Proves the Vercel-Function + anon-RPC + generated-card infra that 5.3 and 5.5 reuse. |
| 4 | **5.3 — Post-Trip Recap** | Rides 5.1's infra; closes the post-trip gap in every strategy doc. |
| 5 | **5.5 — .ics feed** | Also rides 5.1's infra; narrower audience, do last. |

### Open questions for the Tech Lead

1. **5.1 hosting** — a `/api` dir added to the existing Vercel project (needs `vercel.json` rework),
   a separate small Vercel project for `vacationist.app/t/*`, or a build-time generated page (static,
   no per-view rate limiting, token space leaks into the sitemap unless excluded)?
2. **Indexability** — should Public Trip Pages be `noindex` (pure sharing surface) or indexable (SEO
   play, but needs moderation + a takedown path first)?
3. **Moderation posture** for publicly-exposed user-authored trip titles/descriptions — report link +
   manual takedown enough for launch, or block on something more?
4. **`trips.location`** — worth an additive freetext column to headline the public page / recap /
   calendar feed, given `timezone` is Europe-only and too weak?
5. Confirm the Phase 0 / 5.0 event names (`trip_created` / `share_link_created` / `share_link_viewed`
   / `invite_accepted`).

---

## Measurement

**Today `npm run analytics:report` shows:** page visits, source/campaign segmentation, store-click-through, and sign-ups with first-touch attribution. Good enough to judge *top-of-funnel* per channel.

**It cannot show:** whether an install becomes a trip, whether a trip generates invites, whether invites bring new users. Phase 0 closes this. Until then, treat all "which channel works" conclusions as install-count proxies.

**The metric that matters** (per `zero-budget-growth-plan.md`'s closing section): new users arriving from invite links sent by people the founder doesn't know. That is the K-factor signal. It needs `invite_accepted` with attribution — Phase 0.

---

## Decisions (resolved 2026-09-08 by the Tech Lead)

1. **Pro ships at ~500 MAU.** Currently ~50–60 MAU — roughly 10× away, real but not near. So the "explicitly not doing" list below stands for now.
   - ⚠️ **Action needed:** the live site already asserts Pro exists (`features/expenses.md` "Pro adds more planning days per year", `vs/splitwise.md` "adds more planning days per year and unlimited members", `blog/group-trip-receipts-and-expense-reports.md`, `docs/llms.txt`). At ~1/10th of the launch threshold this is premature and inaccurate. **Fold a copy softening into Phase 1** — change assertions of a current Pro tier / planning-day limit to "planned" or drop the specifics until it ships. Small content sweep, EN + DE, via `npm run build:site`.
2. **Play Store / App Store listing name — already done.** Play Store: *"Vacationist Gruppenreiseplaner"* (DE) / *"Vacationist Group Trip Planner"* (EN). App Store: same names, per locale. The keyword "Group Trip Planner" / "Gruppenreiseplaner" is in the title — the June ASO recommendation is satisfied. `play-store/listing.md` should be checked for drift against this.
3. **Product Hunt cost:** launching is **free**. Budget ~$200–500 in supporting spend for indie launches (demo video, design polish) — most of which can be done in-house here. Optional "Product Hunt Pro" (~$100/mo) is not needed for a launch. Timing: still open — sequenced after Phases 1–2 so the landing page and reviews are ready.
4. **Screenshot set: Greece** (`play-store/screenshots/`) — matches the live store listings. Barcelona set stays for Reddit ad creatives only.
5. **New analytics event names** — proposed `trip_created` / `invite_sent` / `invite_accepted` / `expense_added`; confirm exact names when Phase 0 starts.

---

## Explicitly not doing (until Pro ships — planned at ~500 MAU, currently ~50–60)

So these stop being re-proposed every planning cycle:

- Loosening / reframing the free tier — there is no tier.
- Free Pro subscriptions as influencer barter — nothing to grant. (Offer early access / a shout-out / a founder call instead.)
- Referral program that grants bonus days — no days to grant. A referral program that grants *nothing* has no incentive; revisit when Pro ships.
- Apple Search Ads / Google UAC / Meta at scale — the budget is small and Reddit-focused, and CPI can't be evaluated against LTV while LTV is zero.

---

## How the older docs relate

| Doc | Keep for | Do not use for |
|---|---|---|
| `marketing-strategy.md` | Personas, competitor teardowns, keyword clusters, the 200 content ideas | Its Executive Summary conclusions, the "iOS is a blocker" framing, ASO "current state" |
| `zero-budget-growth-plan.md` | Per-channel playbooks (Reddit, TikTok, LinkedIn, influencer outreach), the leading-vs-lagging indicator discipline, "inconsistency is what kills this" | The week-by-week 90-day calendar (expired), the 3 opening "fixes" (free tier / ASO / PostHog) |
| `seo-strategy.md` | Everything — it is current and maintained | (nothing — but note the two staleness fixes applied 2026-09-08: cluster-5 post shipped, screenshots unblocked) |
