---
name: ios-app-store-rollout
description: Use when touching the landing page download CTA, the post-trip rating/review nudge, qr-codes/, or App Store listing metadata — Phase 16 (2026-08-17) already made four Tech Lead decisions on these that should not be re-litigated without a new explicit call.
---

# Phase 16: iOS App Store rollout (v1.32.0)

Vacationist went GA on the Apple App Store on 2026-08-17 (`https://apps.apple.com/us/app/vacationist/id6800049398`, App Store Connect id `6800049398`, Team ID `93VX3MQ439`). `apps/mobile/app.config.ts` already had a complete iOS config since v1.30.0 (bundle id, `AppStoreID`, associated domains) — Phase 16 was entirely about replacing "Play Store only"/"iOS coming soon" copy across the app and marketing site, and making the post-trip rating nudge platform-aware. See [[phase10-website]] (superseded Android-only note) and [[marketing-site-build]] for the site build pipeline this touched.

**Four decisions confirmed with the Tech Lead:**

1. **Rating nudge**: the DB/push copy for the `review_nudge` notification is store-neutral (no "Play Store" wording). Tapping it calls a native `expo-store-review` prompt (`openStoreReviewOrFallback()` in `apps/mobile/src/utils/openStoreReview.ts`) with a platform-correct store-URL fallback (`apps/mobile/src/utils/storeUrl.ts`), instead of a hardcoded `play.google.com` link. The separate client-side `useStoreReviewNudge.ts` hook (30-day cooldown, fires when a trip completes) was already cross-platform and is left untouched — the two mechanisms serve the same goal but were deliberately not merged.
2. **Landing page download CTA**: always show two equal store badges (Play + App Store) everywhere — no user-agent detection or "primary CTA for your platform" logic. Applies to `docs/index.html`, `marketing/site/build.mjs`'s sitewide `ctaHtml()` band, `docs/join.html`.
3. **QR code**: no new iOS-specific QR asset. The already-printed physical QR labels encode `vacationist.app/scan/android-qr` — that page keeps its URL/name and just got a real, live App Store button added next to the Play button. Do not create a `qr-codes/iOS/` directory or a `/scan/ios-qr/` page without a new Tech Lead decision (reprinting cost is the blocker).
4. **Store listing assets**: no repo-side `app-store/` folder mirrors `play-store/` (which holds icon/feature-graphic SVGs, screenshot mockups, `listing.md`). App Store Connect metadata (subtitle, keywords, description, "What's New") is managed directly in ASC, not versioned in this repo.

**Why this matters:** a future session touching the landing page, review nudge, QR pipeline, or store listings should not re-propose "detect the visitor's platform and show one badge", "generate an iOS QR", or "add an `app-store/` folder" as if undecided — these were explicitly weighed and rejected/confirmed already.

**Other things fixed in the same pass** (mechanical correctness, not decisions): a pre-existing bug where tapping a push notification for `review_nudge` called `router.push()` on a raw `https://` URL instead of opening it — same root cause affected all notification types with an https path, fixed with a `startsWith('https://')` guard in the push-tap handler and the two in-app notification list screens; `NotificationItem.tsx`'s `BODY_TEMPLATES` had no `review_nudge` entry, so the in-app list showed the raw English DB body under a generic "Reminder" title in both locales — fixed by adding it plus a `type.review_nudge` i18n key; the `analytics_events` event taxonomy gained `app_store_click` (kept `app_store_interest` in the CHECK constraint for historical rows — dropping it would fail `ADD CONSTRAINT` validation against existing data).

**Key migrations:** `20260817100000_review_nudge_store_neutral.sql` (function-body-only replace), `20260817110000_add_app_store_click_event.sql` (constraint widening). Deployed to both dev and prod Supabase the same day (2026-08-17), along with `push-notification` and `track-event` Edge Function redeploys — verified end-to-end via curl on both environments.

**Copy + icon conventions (fixed 2026-08-17, same day):** the store badge labels are **"Get it on Play Store"** and **"Get it on App Store"** (not "Get it on Google Play" / "Download on the App Store"). The Apple glyph must be sized to visually match its neighboring Play triangle at each call site. When a store button is a real `<a>`, always reuse the exact same CSS class the Play button uses at that call site — a real bug shipped on `docs/scan/android-qr/index.html`, where the App Store link kept the old placeholder classes (`.btn-ghost`/`.btn-soon`, leftover from the pre-GA "Coming Soon" `<div>`), which lack `text-decoration: none`, so it rendered underlined and differently styled from the neighboring Play button. Check any future store-badge addition for this same class-reuse mistake.

**Not yet done:** `git commit`/`push` of the app code and marketing site to `main` — separate action from the Supabase deploy, still pending explicit approval per [[commit-discipline]].

**How to apply:** When asked to touch the landing page CTA, the rating/review nudge, `qr-codes/`, or store listing metadata, check this skill first — the shape of the solution here was already decided, not left open.
