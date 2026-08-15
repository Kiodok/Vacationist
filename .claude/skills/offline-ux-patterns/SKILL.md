---
name: offline-ux-patterns
description: Use when adding any new mutation or list screen — the June 2026 offline overhaul established mandatory conventions (isMutationBusy, getQueryDisplayState, persisted-mutation registration) that every new mutation/screen must follow or buttons/spinners will get stuck offline.
---

# Offline UX conventions

The offline overhaul (2026-06-12) established conventions that every NEW mutation/screen must follow:

1. **Buttons/sheets**: close sheets BEFORE `mutate()` (never in `onSuccess`); pass `isPending={isMutationBusy(mutation)}` (`apps/mobile/src/utils/mutationStatus.ts`) — a paused (offline-queued) mutation keeps `isPending: true` forever, so raw `isPending` freezes buttons offline. Exceptions that keep `onSuccess`-close: `NudgeSheet`, document access request (`settings.tsx`), `CopyPackingListSheet`.
2. **Loading states**: use `getQueryDisplayState(query)` from `apps/mobile/src/hooks/useOfflineAwareQuery.ts` → `showSkeleton` / `showOfflineEmpty` (render `OfflineEmptyState`) / `refreshing` (RefreshControl). Never use `isFetching` for spinners — paused fetches keep it true forever.
3. **New mutations**: add a self-contained `*Variables` type in `packages/types` (tripId in variables, not closure), `mutationKey`, `onMutate` optimistic + `onError` rollback in the hook, mutationFn + `onSuccess` (invalidation + toast) in `apps/mobile/src/utils/mutationDefaults.ts`, and the key in `PERSISTED_MUTATION_KEYS` (`queryClient.ts`). ~50 mutations are now persisted (activities, notes, packing/stuff, accommodations, transfers, updateTrip, expenses, shopping, votes, notifications).
4. **Deliberately NOT persisted**: travel documents, profile/invites/members, sendNudge, copyPackingList, prework, recipes, transfer passenger assignment (stale set-replace risk).
5. `OfflineBanner` shows queued-change count + "Syncing…/All synced" transition via `useMutationState`. The Supabase client has a 15s fetch timeout (60s for `/storage/v1/`). Default `staleTime` is 30s.

**Why:** `offlineFirst` networkMode pauses mutations/queries offline; UI treating "paused" as "in-flight" caused stuck buttons and infinite spinners.

**How to apply:** when adding any feature mutation or list screen, copy the pattern from `useActivities.ts` / `activities.tsx`; never reintroduce raw `isPending` props or `isFetching`-driven spinners directly.
