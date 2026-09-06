---
name: v1-35-1-store-badges
description: Use to answer "what's in v1.35.1" / "status of v1.35.1", or before touching StoreBadges, the global Trips tab header, the trip screen header (app/trip/[id]/index.tsx), EditProfileSheet, users.show_store_badges, apps/mobile/src/utils/storeUrl.ts, or any track-event / logAnalyticsEvent call from apps/mobile. Records the v1.35.1 release — Play/App Store download badges in the web app with a per-user opt-out.
---

# v1.35.1 — Web-app store download badges

`app.config.ts` at `1.35.1` (PATCH → **OTA**, on top of the committed v1.35.0 `c3c4dfb`).
Straight onto `main` ([[no-branches-main-only]]). Web-only feature; renders nothing on native.
`npm run typecheck` + `npm test` (root) green.

**Why:** a large share of new accounts are created on `web.vacationist.app` and never install
the native app. These badges give web users a one-tap path to the stores, on the two
highest-traffic surfaces, with click tracking so the lift is measurable.

## What shipped

- **`apps/mobile/src/components/StoreBadges.tsx`** (new, cross-feature — sits in `src/components/`
  next to `OfflineBanner`). Renders `null` unless `Platform.OS === 'web'` **and**
  `useAuthStore(s => s.user?.show_store_badges) !== false`.
  - **Text-only pills, no glyph.** It originally used Ionicons `logo-google-playstore` /
    `logo-apple-appstore`; the Tech Lead had the icon removed ("re-use the global trips-tab
    badges" = same plain text pill everywhere).
  - Full labels `common:storeBadge.play` / `storeBadge.appStore` ("Get it on Play Store" /
    "Get it on App Store" — the [[ios-app-store-rollout]] wording, **not** the official badge
    wording). Below **640px** `useWindowDimensions().width` the labels shorten to
    `storeBadge.playShort` / `storeBadge.appStoreShort` ("Play Store" / "App Store").
  - Tap → consent-gated `logAnalyticsEvent({ event_name: 'play_store_click' | 'app_store_click',
    surface: 'web_app', path })` then `window.open(url, '_blank', 'noopener,noreferrer')`.
    Gate = `useConsentStore.getState().decision === 'granted'` (mirrors `marketing/site/track.js`).
    This is the **first `track-event` call site inside `apps/mobile`** — `web.vacationist.app` is
    already in the Edge Function's CORS allowlist and both event names + the `web_app` surface
    are already accepted, so no backend change was needed.
  - Colorful: `borderWidth: 2` + web `boxShadow: '0 1px 4px rgba(0,0,0,0.12)'` (bg-surface ≈
    bg-background there). No hardcoded `#fff`/`#000`.
- **`app/(tabs)/index.tsx`** — avatar + `<StoreBadges />` wrapped in a left-hand
  `flex-row items-center gap-sm shrink` group inside the header's `justify-between` row; title
  gained `numberOfLines={1}`. Native layout unchanged (badges render `null`).
- **`app/trip/[id]/index.tsx`** — `<StoreBadges />` inserted immediately **before**
  `<TripNotificationBell />` → header order: back · title · Play · App Store · bell · status.
- **`EditProfileSheet.tsx`** — a `<Switch>` row (`Controller name="show_store_badges"`,
  `value ?? true`) right after "Preferred currency", with hint `profile:edit.showStoreBadgesHint`.
  Seeded in the `reset({…})` on open. Switch `trackColor`/`thumbColor` copied from
  `NotificationPreferencesSection` / `EditExpenseSheet`.
- **`apps/mobile/src/utils/storeUrl.ts`** — new named exports `PLAY_STORE_URL` / `APP_STORE_URL`
  (kept identical to `marketing/site/build.mjs`); `STORE_URL` re-expressed in terms of them, no
  behaviour change for `ForceUpdateGate` / `openStoreReview`.
- **Migration `20260906130000_add_show_store_badges.sql`** — `users.show_store_badges BOOLEAN
  NOT NULL DEFAULT TRUE`. Additive; no RLS change (`users_update_own` is column-agnostic,
  `restrict_user_self_update()` only guards `is_guest`); no `delete_own_account()` change.
  **DEPLOYED dev + prod 2026-09-06**, 240/240 ledger parity, `npm run supabase:types` regenerated.
  See `engineering/supabase.md`.
- **Pre-existing drift fixed in passing** — `packages/types/src/analytics.ts`
  `ANALYTICS_EVENT_NAME` was missing `'app_store_click'` (added to the DB CHECK by
  `20260817110000`, already accepted by the `track-event` Edge Function). Added it.

## Verified (browser, `npm run web`)

Badges on Trips tab + trip header in dark / light / colorful; text-only; opt-out toggle hides
both headers immediately and persists across reload; a real Play-badge click POSTed
`play_store_click` / `surface:web_app` to `track-event` (the extension capture showed **503** —
the known `keepalive` beacon-capture artifact per CLAUDE.md; a direct `curl` with the localhost
Origin returned **204**). Compact (<640px) label swap is verified by code only — the test
harness could not change the viewport width.

## Not done

`git commit` (migration + client in **one** commit on `main`); `eas update --branch production`
after commit; narrow-viewport visual spot-check.

Related: [[v1-35-0-batch]], [[ios-app-store-rollout]], [[marketing-site-build]],
[[no-branches-main-only]], [[commit-discipline]].
