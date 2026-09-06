---
name: v1-36-0-sentry-batch
description: Use to answer "what's in v1.36.0" / "status of v1.36.0" / "how were the Sentry issues fixed", or before touching the Sentry setup (apps/mobile/src/utils/sentry.ts, queryClient.ts mutation-cache subscriber), the Turnstile widget failure path (TurnstileWidget.reportFailure / captchaBrowserFallback), any SectionList/FlatList/FlashList scrollToLocation/scrollToIndex call, the expenses archive/restore control gating, iOS Google Sign-In (useGoogleSignIn / useGuestUpgrade), or the @sentry/react-native dependency version. Records the v1.36.0 release — a batch resolving all 10 open Sentry issues from the last 30 days.
---

# v1.36.0 — Resolve all open Sentry issues (last 30 days)

`app.config.ts` at `1.36.0`. **MINOR → FULL Play Store + iOS build** (because of the
`@sentry/react-native` 7→8 SDK bump), not OTA. Straight onto `main` ([[no-branches-main-only]]).
Plan: `~/.claude/plans/sunny-frolicking-kernighan.md`. `npm run typecheck` + `npm test` green.
Nothing committed / no build yet as of the session that created this.

**Why:** the `vacationist/react-native` Sentry project had 10 unresolved issues over 30 days.
Most were not real bugs — they were expected Postgres business-rule errors (P0001) captured as
exceptions, and Turnstile telemetry the existing `beforeSend` almost-but-not-quite filtered.
Two were real: a fatal `scrollToIndex out of range` crash, and a session-replay ANR from an old
bundled `sentry-android`.

**How to apply:**

## Rule 1 — Expected mutation errors must not reach Sentry
`apps/mobile/src/utils/queryClient.ts`'s mutation-cache subscriber calls
`isExpectedMutationError(error)` (`apps/mobile/src/utils/errorClassification.ts`) before
`Sentry.captureException`. It returns true for Postgres `P0001` (every bare `RAISE EXCEPTION`
in our migrations), `42501` (RLS), `23505`, any `PGRST*` code, and — only on DB-error-shaped
objects — a fragment allowlist (`not found`, `guests cannot`, `permission denied`, …). The
per-hook `onError` toast still fires; only the Sentry issue is suppressed (a breadcrumb is
added instead). When you add a new `RAISE EXCEPTION` message that users can legitimately hit
and it isn't a `P0001`, add its code or a fragment to that helper.

## Rule 2 — Turnstile widget failures are breadcrumbs + logs, never issues
`TurnstileWidget.tsx`'s `reportFailure` uses `Sentry.addBreadcrumb` + `Sentry.logger.warn`,
**not** `Sentry.captureMessage`. `sentry.ts` `beforeSend` also `return null`s any
`turnstile_widget_failed` event defensively, and drops `turnstile_browser_fallback_failed`
whose `reason` is benign (`dismissed, cancel, dismiss, locked, opened, callback-missing-token`
— the iOS `cancel` is the twin of Android's `dismissed`). Genuine fallback failures
(`open-failed`, `webview-error`, …) still become `level: info` issues. Don't re-add
`captureMessage` for widget failures — `onError` there only sets a flag and the browser
fallback recovers the flow.

## Rule 3 — Never call scrollToLocation / scrollToIndex directly
Use `safeScrollToSectionLocation(ref, sections, target)` / `safeScrollToIndex(ref, itemCount,
params)` from `apps/mobile/src/utils/safeListScroll.ts`. `SectionList.scrollToLocation` throws
a **hard synchronous Invariant** ("scrollToIndex out of range") — NOT delivered to
`onScrollToIndexFailed` — when the `{sectionIndex,itemIndex}` were computed against a
different data snapshot than the list currently holds (realtime reshuffle, pagination, section
collapse, clock-based re-bucketing between a `setTimeout` scheduling and firing). The helpers
bounds-check against the array you pass and swallow any residual race into a breadcrumb.
Also: recompute the target index *inside* the deferred callback, not before the timer, and
clear every nested `setTimeout` in the effect cleanup (the `activities.tsx` highlight-scroll
had an orphaned inner 650 ms timer that re-fired a frozen target forever after
`scrolledForRef` was set). See [[activity-votes-batch-invalidation]] for why activities-tab
sections reshuffle so readily.

## Rule 4 — Guests get no delete/archive controls, even for their own content
`expenses.tsx` `canArchiveOrRestore` is `role !== 'guest' && (role === 'organizer' ||
expense.created_by === currentUserId)`. The software guide says guests cannot delete any
content including their own; `archive_expense` enforces it server-side ("Guests cannot archive
expenses"). Showing a guest a control that only produces a failed RPC is the bug. Apply the
same `role !== 'guest'` gate to any new delete/archive/restore affordance.

## Rule 5 — Wait for AppState 'active' before native sign-in on iOS
Call `await awaitAppActiveForNativePresent()`
(`apps/mobile/src/features/auth/utils/awaitAppActive.ts`, iOS-only, polls for `active` then a
350 ms settle) before `GoogleSignin.signIn()` in **every** entry point (`useGoogleSignIn.ts`,
`useGuestUpgrade.ts`). The Turnstile browser fallback (`ASWebAuthenticationSession`) resolves
its promise while its presentation is still tearing down, leaving iOS with no root view
controller; `GoogleSignin.signIn()` then raises an **un-catchable**
`NSInvalidArgumentException: |presentingViewController| must be set.`. Also: configure the
`GoogleSignin` singleton from every entry point (`getConfiguredGoogleSignin()` in
`configureGoogleSignin.ts`) — it's static state and `useGuestUpgrade` reached `signIn()`
without ever configuring it. See [[auth-native-google-signin]].

## Rule 6 — @sentry/react-native ≥ 8.25.0 for the replay ANR
`~8.25.0` bundles native `io.sentry:sentry-android:8.55.0`, which has the fixes for the
`ReplayIntegration.start()` → `AutoClosableReentrantLock` → main-thread `park` ANR (upstream
8.46 lazy-lock alloc, 8.51 replay deadlock, 8.54 defer replay start off the init critical
path). The 7.x line (`~7.13.0` max) hardcodes `sentry-android:8.32.0` and can't get the fix.
7→8 needs iOS 15+ / Xcode 16.4+ / AGP 7.4+ / Kotlin 1.8+ — all met by Expo SDK 55 / RN 0.83;
the JS `Sentry.init` API (incl. `mobileReplayIntegration`, `feedbackIntegration`, `beforeSend`,
`enableLogs`, `Sentry.logger`) is unchanged. **This bump is why v1.36.0 is a full build.**
Preview-build + device-test it first, in isolation. See [[sdk-upgrade-55]].

## Issue housekeeping
- **REACT-NATIVE-A** (`retryOrFail` / `reason:timeout`) — dead code deleted in `c608f55`
  (2026-08-09), pre-1.29.1 clients only. Resolve manually in Sentry.
- Everything else auto-closes via `Fixes REACT-NATIVE-<x>` trailers in the v1.36.0 commit.
- **REACT-NATIVE-F** (web `getComputedStyle must be an instance of Element`) — two regexes
  added to `sentry.ts` `ignoreErrors`. Suspect `react-native-safe-area-context@5.6.2` web
  build's probe-`<div>` cleanup order, or `react-remove-scroll` via `vaul`/`expo-router`.
