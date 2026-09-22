---
name: v1-39-0-batch
description: Use to answer "what's in v1.39.0" / "status of Phase 21", or before touching offline optimistic-row rehydration, expense categories/tip, the iOS DateTimePickerField tray, Settle All, getQueryDisplayState/QueryErrorState, offline vote casting, prework/recipes prefetch, the shopping item delete confirm, or the "Couldn't sync" mutation-failure UI (removed in round 3 — do not re-add). Records the offline-hardening + UX batch across 3 rounds, the root causes found, and exactly what is still unverified.
---

# v1.39.0 / Phase 21 — offline hardening + UX batch

**Status (2026-09-22, updated):** all 15+ items across 3 rounds code-complete; typecheck 0; tests utils 229 /
api 30 / mobile 245. **Client still NOT committed** (the Tech Lead tests first). **All 4 migrations are now
LIVE on prod** as of 2026-09-22 (pushed at the Tech Lead's explicit request, ahead of the client commit —
see `engineering/supabase.md`'s "2026-09-22 (later)" entry): `20260920100000` (re-applied after its earlier
2026-09-20 revert), `20260921100000`, `20260921110000`, `20260922100000`. Each was re-verified safe for the
*currently-live* (pre-v1.39.0) client before pushing — every new/changed param is a trailing `DEFAULT` or a
pure `CREATE OR REPLACE` with no signature change, so the old app keeps working unmodified. Schema parity
confirmed via `gen types --linked` dev vs prod, zero diff. **The client commit is no longer gated on a
migration push** — what's still pending is `preview-dev` EAS build + full device pass + Tech Lead approval
to commit.

## Decisions already made (don't re-litigate)
+6 expense categories; tip adds to the total and is split with it; offline bar removed entirely; Settle All
currency is display-only. **Superseded in round 2 (below):** the left trip drawer, tap-to-vote and the timezone
picker were all rejected in device testing and removed.

## Root causes (each refined the first guess)
- **Optimistic rows lost on restart.** `stripOptimisticRows` removes them from the persisted cache, but the
  queue replays and `onMutate` lives in hooks that don't exist at boot → `utils/optimisticRehydrate.ts`
  re-applies them after `hydrate()`, outside the try/catch that deletes the queue on error.
- **"Missing from All Items".** Two separate query keys; every patch wrote only one.
- **Settle All ignored after one offline tap.** `settlingRef` was reset in a per-call `onSettled`, which never
  fires for a paused mutation (in addition to the raw-`isPending` spinner).
- **Un-freezing a paused non-persisted mutation's button would have duplicated it** (it stays paused in memory
  and resumes on reconnect). The mutation-cache subscriber now drops it from the cache after its toast.
- **A category is enforced in THREE places** (table CHECK + hard-coded guards in both expense RPCs + the TS
  enum), and `computeTripCostSummary` silently dropped any new `expense_<category>` source from the trip total.
- **Timezones:** the `Etc/GMT` sign is inverted (`Etc/GMT-5` = UTC+5); `Europe/Kyiv` is unsafe on old Android
  ICU (use `Europe/Kiev`, label "Kyiv"); an unknown zone makes `dayjs.tz` throw.
- **iOS time picker:** the panel sat inside the scrim `Pressable` and set `onStartShouldSetResponder`, claiming
  every touch over the native `UIDatePicker`. Scrim is now a *sibling* (same shape as `SwipeToDismiss`).
- The Trips list's `paddingBottom: 80` is FAB clearance, not dead space — leave it.

## Still UNVERIFIED — check before release
- Browser-verified on web (dev DB, 2026-09-20): drawer (all themes), tip live total, new categories, timezone
  field/picker + search. NOT verified: tap-to-vote, offline toast/indicator/sync, tip end-to-end from the
  client, Settle All. **No device run at all; the iOS picker fix is an unverified diagnosis** — needs a real
  iPhone / TestFlight run.
- Found in the browser run: core `Animated.View` ignores `className` (use explicit styles; native behaviour
  unproven); Metro served a STALE bundle until `expo start --web --clear`; two `.replace('Europe/', '')`
  timezone labels (overview, profile) now use `timezoneLabel`.
- Item 6 (offline expense not syncing on reconnect) was **not reproduced**; only plausible causes were fixed.
  `utils/replayQueue.ts` (refresh → replay → refetch) is defensive, not a proven cause.
- The 6 new donut hues were checked with an ad-hoc ΔE script — `scripts/validate_palette.js` wasn't available.
- Verified for real on dev: types byte-identical to `gen types --linked`; constraints read back; both rewritten
  RPCs run (incl. rejections) in a self-rolling-back `DO` block, 0 leaked rows.

## How to apply
Adding a mutation whose row must survive a restart → see [[offline-ux-patterns]] item 5. Adding an expense
category → update the CHECK, both RPC guards, `EXPENSE_RELATED_TYPE`, labels/icon/colour (see
`EXPENSE_CATEGORY_ICON_COLORS`, `ExpenseCategoryChart`), and add a test; do **not** hardcode additive cost
sources. Adding a timezone → it must exist in old Android ICU; run `timezones.test.ts`.

Related: [[offline-ux-patterns]], [[offline-session-durability]], [[sheet-swipe-to-dismiss]], [[commit-discipline]].

## Round 2 — the 21.09.26 test session (`Test 21.09.26.docx`)
Same version (nothing was committed). Full detail: `engineering/implementation_guide.md` Phase 21 "Round 2".
- **Offline creates mint a client UUID** → [[offline-client-generated-ids]]. Root cause of "can't add an item to a
  list created offline" (OFF4, which blocked the whole offline test program). `scope` per family orders replay;
  seeded item caches; queued failures were parked in Profile → "Couldn't sync" (`queuedFailure.ts`,
  `failedMutations.ts`) instead of dropped (OFF-8 — exact cause unproven, expired JWT is the hypothesis).
  **This "Couldn't sync" UI was reverted in round 3 — see below.**
- **Proactive offline cache**: `useGlobalOfflinePrefetch` + `utils/offlinePrefetch.ts` (all planning/ongoing trips +
  global tabs). Prefetch query keys must equal the screen hooks' keys.
- **Reverts:** tap-to-vote gone (read-only `VoteSummary`, ring kept); drawer → pill bar + native-only first
  **Menu** pill (`TripMenuTab`); web has pills only.
- **Timezones removed** → [[floating-wall-clock-times]]: no picker anywhere; `activityStatus.ts`; per-recipient
  reminder cron (migration `20260921110000`); `useDeviceTimezoneSync`.
- Expense sheet: per-trip remembered currency ("Set1"), exact-split seed + `amount_owed_original_currency`
  prefill + **Add/Save disabled while Remaining ≠ 0**; German "Shopping"/"Supermarkt".
- `createTrip` offline → "needs a connection" pre-check; toasts dedupe, warnings auto-dismiss, opaque + border.
- All Items: empty lists shown, grouped by list id, delete allowed (organizer any / participant own).
- **Test build:** `eas build --profile preview-dev --platform android` = release-like (embedded JS) + DEV backend.
  `preview` points at PROD. Dev client can't force-close/relaunch offline.
- **Prod:** `20260921100000` and `20260921110000` are now live on prod (pushed 2026-09-22, together with
  `20260920100000` and round 3's `20260922100000` — see the top status line). Tests: utils 229 / api 16 /
  mobile 247. **No device run of round 2.**

## Round 3 — the 22.09.26 test session (`Test 22.09.26.docx`)
Same version, still uncommitted. Full detail: `engineering/implementation_guide.md` Phase 21 "Round 3". Three
parallel investigations root-caused everything before any fix; most of round 2 held up (confirmed working:
chat/expense/accommodation/vote/packing/shopping/note sync, no-flicker reconnect).
- **One root cause, three offline symptoms**: `getCurrentMemberRole` (`packages/api/src/members.ts`) was the
  only read in the package that swallowed an error into a trusted `null` instead of throwing — offline, this
  silently overwrote the cached role, hiding shopping delete, activity Edit/Close-voting/Reopen-voting, and
  the Overview "Edit trip" pencil. Fixed, and the underlying mechanism (an anon-key fallback masquerading as a
  real empty/not-found result) turned out to be systemic → **full audit of `packages/api`** →
  [[anon-key-fallback-guard]] (new skill — read it before adding any new `packages/api` read).
- Same mechanism explained two more: `useTrips.ts`'s `TripNotFoundError` purge (no longer trusted unless the
  session looks valid — this was "some trips randomly fail to load offline") and `QueryProvider.tsx`'s
  `shouldDehydrateQuery` (now persists any query with data, not only `status === 'success'` — a merely-errored
  refetch used to erase good cached data from disk within 4s).
- **`getQueryDisplayState` gained a `showError` state**, swept across all 22 consumers + a new shared
  `<QueryErrorState>` — a genuine failure with no cached data used to fall through to a screen's own "nothing
  here" empty state, indistinguishable from real emptiness (the Prework false "no topics yet", and the trip
  screen's "could not be loaded" over a trip with good cached data — that screen's `isError || !trip` check ran
  before checking for cached data at all).
- **Voting didn't visibly work offline** — a THIRD, separate cause: `useCastVote`'s `onMutate` (`if (previous)`)
  skipped the optimistic write when nothing was cached yet, and the per-activity votes key was never
  prefetched. Fixed: seed from `previous ?? []` unconditionally (activities/accommodations/flights); activities'
  `prefetchTripData` now seeds every `['activities', id, 'votes']` from the already-fetched trip-level batch;
  accommodations/flights (no batch) get a bounded per-entity prefetch loop.
- **Prework + Recipes were never prefetched at all** — added to `prefetchTripData`, including the per-topic
  preference queries.
- Shopping item delete now needs an inline confirm step (ticking stays single-tap, tester's explicit verdict);
  found while there — `EditShoppingItemSheet.tsx` was the only sheet with zero i18n.
- **"Couldn't sync" removed** — confused users, Retry rarely helped, raw server errors weren't meaningful. Kept
  invisibly: one silent auth-retry before falling back to the same generic toast every non-persisted mutation
  already used. `failedMutations.ts` / `FailedSyncSection.tsx` deleted.
- **Deleted-member expense split** → [[deleted-member-expense-split]] (new skill). Not a bug in
  `delete_own_account()` — display + edit-sheet fixes, plus migration `20260922100000` (sentinel exemption in
  both expense RPCs) and a hard lock on split composition whenever a sentinel share is present.
- **Prod:** `20260922100000` is now live on prod (pushed 2026-09-22, together with the other 3 pending
  migrations — see the top status line). `preview-dev` EAS build still not run. Tests: utils 229 / api 30 /
  mobile 245. **No device run of round 3.**
