# Google Play Data Safety — Declaration Reference

**Purpose:** the exact, audited answer set for Play Console → **Policy → App content → Data safety**,
maintained so a future feature that adds a new data flow updates this doc in the same PR (see the
rule added to `CLAUDE.md`). Written 2026-08-09 after v1.29.1 was rejected for an invalid Data
safety form (missing account-deletion URL, and the form under-declaring collected data — Google's
notice named **email address** specifically).

This document does not touch the Play Console form itself — that's a Tech Lead action, described
at the bottom. It exists so that action is a data-entry exercise against an already-verified list,
not a fresh audit under deadline pressure.

## Method

Every entry below was traced to the actual source in `apps/mobile` and its workspace dependencies
(`packages/api`, `packages/utils`, `packages/types`) — not inferred from `docs/privacy-policy.html`,
though the two should and do agree. "Shared" (Play's term) means sent to a company other than
Supabase (our processor) or Google/Firebase (the OS-level push transport) for that company's own
purposes — this is what triggers Play's stricter "third-party sharing" disclosure, distinct from
plain "collection".

## Data flows in the Android bundle

| # | Flow | Wired at | Data | Shared with a third party? |
|---|------|----------|------|------|
| 1 | Supabase (backend/auth/storage) | `packages/api/src/client.ts`, used throughout `packages/api/src` | Email, name, avatar, trip/activity/expense/shopping content, travel documents (partially encrypted at rest), IP at network level | No — processor, not a third party under Play's definition |
| 2 | Google Sign-In | `apps/mobile/src/features/auth/hooks/useGoogleSignIn.ts`, plugin in `app.config.ts` | OAuth ID token, email, profile | This is Play's **"OAuth" / sign-in via third-party account** checkbox — tick it |
| 3 | Sentry | `apps/mobile/src/utils/sentry.ts`, `@sentry/react-native/expo` plugin | Crash logs, stack traces, breadcrumbs (sanitized fetch URLs), session replay (masked, 10% sample + 100% on error), **screenshots on error**, performance traces (20% sample), user id, trip id/role tags, device/app version, locale. Always-on (`enabled: !__DEV__`), no consent gate | **Yes** — Sentry (Functional Software Inc.) is a distinct company processing crash/diagnostic data for its own service delivery |
| 4 | Expo push + Firebase Cloud Messaging | `apps/mobile/src/features/notifications/utils/registerForPushNotifications.ts`, `packages/api/src/pushTokens.ts`, `google-services.json` | Device-specific push token | Push delivery infra (Expo/Google) — declare under **Device or other IDs**, not as marketing sharing |
| 5 | Cloudflare Turnstile | `apps/mobile/src/features/auth/components/TurnstileWidget.tsx` (WebView → `web.vacationist.app/captcha-embed.html`), fallback in `captchaBrowserFallback.ts` | IP address, browser/device challenge signals, sent to Cloudflare during login/signup/join | **Yes** — Cloudflare, purpose: **Fraud prevention, security, and compliance** |
| 6 | Reddit Conversions API (sign-up attribution) | `apps/mobile/src/features/consent/utils/trackSignUp.ts` → `supabase/functions/attribution-capi` → `ads-api.reddit.com` | Sign-up event, Play Install Referrer-derived `rdt_cid`/UTM params (`installReferrer.ts`), user-agent, a generated conversion ID, first-party user id | **Yes** — Reddit, purpose: **Advertising or marketing**. Server-to-server, but the payload is sourced from the device and reports a real user action, so it counts as sharing |

## Not present in the Android bundle (verify before assuming otherwise)

- **Reddit client-side pixel** (`apps/mobile/src/utils/webPixel.ts`, `useConsentPixel.ts`) — `Platform.OS === 'web'`-guarded, no-ops on native.
- **Vercel Analytics / Speed Insights** — listed in `apps/mobile/package.json` but only imported from `VercelWebTools.web.tsx`; the platform-suffixed file is excluded from native Metro bundles. The unsuffixed `VercelWebTools.tsx` renders `null`.
- **First-party `analytics_events` logging** (`logAnalyticsEvent`, `packages/api/src/analytics.ts`) — exported from the shared API package but has **no call site in `apps/mobile`**; the `track-event` Edge Function's CORS allowlist is web-origin-based and rejects native's originless requests in practice.

## Play Console taxonomy mapping

Minimum categories that must be checked "Yes, collected" (and "Shared" where marked):

- **Personal info → Name** — collected (flow 1)
- **Personal info → Email address** — collected (flow 1) — **this is the type Google's rejection named as undeclared; confirm it is checked**
- **Photos** — avatar (flow 1)
- **Personal identifiers** — travel document fields (flow 1)
- **App activity / Other user-generated content** — trips, notes, chat messages (flow 1)
- **App info and performance → Crash logs, Diagnostics** — collected (flow 1 telemetry) **and Shared** (flow 3, Sentry)
- **Device or other IDs** — push token (flow 4); Reddit click ID (flow 6) — **Shared**, purpose *Advertising or marketing*
- **Sign-in with a third-party account (OAuth)** — tick, per flow 2

## Two judgement calls for the Tech Lead — not resolved by this audit

1. **Sentry session replay / on-error screenshots may capture in-app content.** If a crash or a
   sampled replay session occurs while the travel-documents screen is open, the replay/screenshot
   could contain document data even though the field itself is encrypted at rest in Supabase.
   Either declare replay data as potentially including sensitive personal info, or verify (in the
   Sentry dashboard's replay privacy config) that sensitive screens are masked/excluded, and note
   the verification here once done.
2. **The Reddit CAPI report on native fires with no in-app consent gate.** `ConsentBanner`
   (`apps/mobile/src/features/consent/components/ConsentBanner.tsx`) is hard-gated to
   `Platform.OS === 'web'` and never renders on Android; `trackSignUp.ts` carries the original
   author's inline comment flagging this as unresolved ("native also has no equivalent banner...
   worth a final legal check if that's not the intended posture"). Declaring the flow honestly in
   the Data Safety form (as this document does) satisfies *Play's* requirement. Whether firing an
   advertising-attribution report with no on-device consent mechanism satisfies GDPR for EU users
   is a separate question, deliberately out of scope for this pass — flagged here so it isn't lost.

## Play Console steps (Tech Lead action, not covered by this repo)

1. **Policy → App content → Data safety → Manage → Start.**
2. *"Does your app collect or share any of the required user data types?"* → **Yes**.
3. Walk each category in the taxonomy table above; for each, tick the purpose(s) — primarily *App
   functionality* for flows 1–2 and 4, *Fraud prevention/security* for flow 5, *Analytics* and
   *Advertising or marketing* for flows 3 and 6 respectively.
4. Tick **"Data is collected via OAuth"** (flow 2).
5. Under **Data deletion**, select "Users can request their data is deleted", and paste
   `https://vacationist.app/delete-account.html` into the account-deletion URL field. Requirements
   verified against [Google's account deletion policy](https://support.google.com/googleplay/android-developer/answer/13327111):
   functional, references the developer name as shown on the store listing (Gary Lude), states
   deletion steps prominently, and works without re-installing the app (the web.vacationist.app
   route) — all satisfied by `docs/delete-account.html`.
6. Submit, then resubmit the v1.29.1 build for review.
