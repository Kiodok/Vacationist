---
name: v1-37-3-batch
description: Use to answer "what's in v1.37.3" / "how was Sentry REACT-NATIVE-N handled", or before touching sentry.ts sampling config, queryClient gcTime, the QueryProvider persister, or useTripOfflinePrefetch. Records the v1.37.3 PATCH — memory / main-thread headroom in response to a (likely false-positive) iOS WatchdogTermination.
---

# v1.37.3 — iOS WatchdogTermination / memory headroom

**Now shipping as part of v1.38.0.** These changes were designed as an OTA-eligible PATCH, but the
uncommitted pile they live in also picked up [[sheet-swipe-to-dismiss]] (Phase 20), which adds
`react-native-gesture-handler` — a native module. So the whole batch is one `1.38.0` FULL store
build, not an `eas update`. The changes below are unchanged; only the version/delivery moved.
Builds on v1.37.2 (`d91fe3a`). Not committed; Tech Lead deploys.

## The trigger

Sentry `REACT-NATIVE-N` — `WatchdogTermination`, no stack, `in_foreground: true`, **1 event / 1
user**, release 1.37.2, iPhone 16 Pro (8 GB), minutes after a fresh build. First ever. **Assessed
as a Sentry false positive** — see [[sentry-watchdog-termination-noise]]. No corroborating OOM
evidence. A memory audit still found real pre-existing pressure worth trimming.

## The changes (Tech Lead decisions this session)

1. **`sentry.ts` diet** — `enableWatchdogTerminationTracking: false`; `profilesSampleRate` 0.1→0;
   `tracesSampleRate` 0.2→0 + `enableAutoPerformanceTracing: false` (also kills stall/frame
   tracking — accepted); `replaysOnErrorSampleRate` 1→0.2 (~80% of sessions then keep no rolling
   in-memory replay buffer). Kept: session replay 0.1, masking, `attachScreenshot`.
2. **`queryClient.ts` `gcTime` 30 d → 24 h.** The persister's `maxAge: 30 d` (disk) backs offline,
   not in-memory retention — the disk blob re-hydrates in full each launch and mounting a screen
   re-activates its queries. 30 d `gcTime` only let the in-memory cache grow unbounded across a
   long foreground session (nothing calls `queryClient.clear()`). **Don't re-raise it.**
3. **`QueryProvider.tsx` persister `throttleTime` 1 s → 4 s.** `createSyncStoragePersister`
   deep-copies + `JSON.stringify`s the whole cache on the JS thread — at 1 Hz on a large cache
   that's a main-thread stall (the classic watchdog-hang shape). Mutation queue persists
   separately and is untouched.
4. **`useTripOfflinePrefetch` concurrency cap** — new `apps/mobile/src/utils/concurrency.ts`
   `runWithConcurrency(tasks, 4)` (+ `concurrency.test.ts`) replaces the ~20-way
   `Promise.allSettled`. Still prefetches everything, incl. the whole-trip `getAllActivities` /
   `getAllExpenses` (full offline calendar kept) — just 4 in flight at a time.
5. **`apps/mobile/src/utils/memoryPressure.ts`** — `installMemoryPressureHandler()`, mounted in
   `app/_layout.tsx`; iOS `AppState` `memoryWarning` → `Image.clearMemoryCache()` + breadcrumb.
   Deliberately does NOT trim the query cache (a re-persist would erode the offline disk blob).
6. `app.config.ts` → **`1.38.0`** (was bumped to `1.37.3` first, then to `1.38.0` when Phase 20
   landed in the same pile). Tests green; typecheck 0.

## Remaining

iOS device check (heavy tab navigation → resident memory plateaus, not climbs per trip);
`git commit`; **FULL store build** (`eas build --profile production`, both platforms) — no longer
`eas update`; resolve `REACT-NATIVE-N` after release. The Android AAB / `dumpsys meminfo` baseline
(Phase 17 §2b) is still open — this batch was iOS-triggered and JS-only.

Related: [[sentry-watchdog-termination-noise]], [[v1-37-2-batch]], [[offline-session-durability]],
[[sheet-swipe-to-dismiss]].
