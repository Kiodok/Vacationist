---
name: v1-37-0-batch
description: Use to answer "what's in v1.37.0" / "status of Phase 19 / the offline overhaul", or before touching auth boot, the persisted mutation queue, NetworkProvider, or QueryProvider persistence config. Tracks the v1.37.0 offline-mode overhaul.
---

# v1.37.0 — Phase 19: Offline Mode Overhaul

Goal: usable offline for a week without ever showing the (network-only) login screen; queued
writes never silently lost. Single release, MINOR / full store build. **No DB migration.**
Plan: `~/.claude/plans/snappy-crafting-bird.md`.

## Done (typecheck + `npm test` green; NOT committed)

**A — auth session durability**
- `packages/api/src/session.ts` (new): `readStoredSession`, `getUserIdOfflineSafe`,
  `hasStoredSession`, `NotAuthenticatedError`.
- `client.ts`: `AUTH_STORAGE_KEY` (derived `sb-<ref>-auth-token`, matches auth-js — NOT an
  explicit `storageKey`, which would orphan installed users). Also `reconnectRealtime`,
  `refreshSessionQuietly`.
- `auth.ts` `getSession()` wrapper returns `null` instead of throwing.
- Swept ~33 `if (!session?.user) throw new Error('Not authenticated')` → `getUserIdOfflineSafe()`
  across accommodations, activities, accommodation-notes, activity-notes, invites, members,
  notes, notifications, prework, recipes, shopping, stuff, transferFlights/PublicTransport/
  Rentals/Vehicles, trips, expenseDocuments, transferDocuments.
- `apps/mobile/src/features/auth/utils/authSnapshot.ts` (new): 7-day window.
- `OfflineReauthGate.tsx` (new, mounted in `_layout.tsx`), `authStore.offlineReauthRequired`.
- `useAuthInit.ts` rewritten: splash releases before `ensureUserProfile`; offline+credentials
  never `reset()`s; `SIGNED_OUT` only clears when `readStoredSession()` is null.
- `auth` i18n `offlineReauth.*` (en + de).

**B — persistence**
- `apps/mobile/src/utils/mutationQueue.ts` (new): offline queue in MMKV `MUTATION_QUEUE_v1`
  (14-day cap), separate from the query cache.
- `QueryProvider.tsx`: `shouldDehydrateMutation: () => false`, `maxAge: 30d`,
  `buster: Constants.expoConfig.version`.
- `queryClient.ts`: `gcTime` 30d; added `settleAllExpenses` + `deleteAllNotifications` to
  `PERSISTED_MUTATION_KEYS` (+ new `deleteAllNotifications` default).
- `persistedMutationKeys.test.ts` (new): keys ⟷ defaults guard.
- `mmkvStorage.web.ts`: `QuotaExceededError` eviction guard.

**C — realtime reconnect (done)**
- `NetworkProvider.tsx`: offline→online edge fires `refreshSessionQuietly` + `reconnectRealtime`
  + `resumePausedMutations` + `invalidateQueries` (debounced 1s).
- The 4 realtime hooks that had no status callback (`useTripChatRealtime`, `useShoppingRealtime`,
  `useRecipesRealtime`, `useIngredientsRealtime`) + their `packages/api` builders
  (`subscribeToMessages`, `subscribeToShoppingItems`/`Sync`, `subscribeToRecipesRealtime`,
  `subscribeToIngredientsRealtime`) now take an `onStatus` and use the shared
  `BACKOFF_DELAYS` + reconcile-on-SUBSCRIBED pattern (matches the other 11).

**D — optimistic-feedback sweep (partial)**
- Shopping: `createShoppingItem` / `createShoppingList` (optimistic placeholder + `isOptimisticId`
  strip in the default's onSuccess), `updateShoppingItemGlobal` (optimistic patch).
- Expenses: `settleExpenseSplit` / `unsettleExpenseSplit` / `coverSplit` / `uncoverSplit` — new
  `makeSplitPatchHook` factory patches the `['expenses', <id>, 'splits']` cache + rolls back.
- Votes: `removeActivityVote` / `removeAccommodationVote` / `removeTransferFlightVote` are now
  **persisted** (new `Remove*VoteVariables` types + `setMutationDefaults` + `PERSISTED_MUTATION_KEYS`)
  with optimistic removal; hooks lost their `(tripId, id)` args — call `.mutate({ id, tripId })`
  (3 call sites updated: activities.tsx, accommodations.tsx, transfer.tsx).
- Recipes: `useAddIngredient` moved its `setQueryData` from `onSuccess` → `onMutate` (optimistic
  id, resolved on success).
- **Deferred** (risky / need Variables restructure + call-site changes): `createExpense` /
  `updateExpenseWithSplits` optimistic row (needs client-side split computation),
  `archiveExpense` / `unarchiveExpense` (infinite-list patch), transfer passenger add/remove
  (set-replace merge), prework prefs, entity notes via `createNoteHooks`.

**E — trip pack (partial)**
- `expo-image` (`~55.0.11`) added — `MemberAvatar.tsx` + `app/(tabs)/index.tsx` avatar use
  `<Image cachePolicy="disk" recyclingKey={url}>` (all avatars funnel through `MemberAvatar`).
- `apps/mobile/src/features/trips/hooks/useTripOfflinePrefetch.ts` (new) — mounted in
  `app/trip/[id]/_layout.tsx`. On opening a trip online, `prefetchQuery` /
  `prefetchInfiniteQuery` for ~17 tab-level keys + `Image.prefetch` of member avatars (skipped
  on `isConnectionExpensive`). Once per tripId per session, 1.2s deferred.

**F — docs (done)**
- `CLAUDE.md` 🔴 Offline Mode section; `software_engineering_guide.md` §7 rewritten;
  `implementation_guide.md` Phase 19; `supabase.md` "no migration" note. Skills:
  `offline-session-durability`, this one, `offline-ux-patterns` updated. Memory:
  `project_v1_37_0_offline_overhaul`, `feedback_offline_session_never_reset`.
- Tests: `packages/api/src/session.test.ts` (8), `persistedMutationKeys.test.ts` (3).

## Remaining

- D (deferred items above): `createExpense`/`updateExpenseWithSplits` optimistic row,
  `archiveExpense`/`unarchiveExpense`, transfer passengers, prework prefs, entity notes.
- E3: `OfflineEmptyState` on trip calendar / global calendar / trip overview (the 3 packing
  views already have it). Prefetch (E2) mitigates — only bites a never-opened trip offline.
- authSnapshot / mutationQueue round-trip tests.

Related: [[offline-session-durability]], [[offline-ux-patterns]], [[no-branches-main-only]].
