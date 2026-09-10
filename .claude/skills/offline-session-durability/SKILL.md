---
name: offline-session-durability
description: Use before touching auth boot (useAuthInit, AuthGate, the Supabase client's auth config), any packages/api write helper's "who am I" check, or the persisted mutation queue. Phase 19 (v1.37.0) made the app usable offline for a week without ever showing the network-only login screen — these invariants must hold.
---

# Offline session durability (Phase 19 / v1.37.0)

The app must stay usable offline for **7 days** without a connection, then ask for a
biometric / device-PIN confirmation to extend — **never** a hard dead-end at the login screen
(which can't load its Turnstile widget offline).

## Rules

1. **Never `reset()` / sign the user out on a network error.** `supabase.auth.getSession()` is
   not a pure storage read — an expired access token triggers a refresh that fails offline and
   returns `{ session: null, error }` while *keeping* the credentials on disk. The wrapper
   `getSession()` (`packages/api/src/auth.ts`) now returns `null` instead of throwing, and
   `useAuthInit` treats "stored session on disk + inside the trust window" as signed-in.
2. **Every `packages/api` write helper reads identity via `getUserIdOfflineSafe()`**
   (`packages/api/src/session.ts`), never `const { data:{session} } = await
   supabase.auth.getSession(); if (!session?.user) throw new Error('Not authenticated')`. The old
   pattern threw a *non-network* error offline, which defeated TanStack's offline mutation queue.
   Void-return helpers use `try { userId = await getUserIdOfflineSafe() } catch { return }`.
3. **The offline mutation queue lives in its own MMKV key** (`MUTATION_QUEUE_v1`,
   `apps/mobile/src/utils/mutationQueue.ts`), NOT inside the main query-cache blob. The query
   cache is `maxAge: 30d` + version-`buster`; the queue is valid until it drains (14-day safety
   cap). `PersistQueryClientProvider` has `shouldDehydrateMutation: () => false`.
   **In-memory `gcTime` is 24h, NOT 30d** (v1.37.3) — the disk blob (`maxAge: 30d`) backs offline,
   re-hydrates in full each launch, and re-activates on screen mount, so a long `gcTime` adds no
   offline benefit and only grows the cache unbounded over a long foreground session. Persister
   `throttleTime` is `4s` (sync serialize is on the JS thread). Don't "re-sync" `gcTime` to
   `maxAge`. See [[v1-37-3-batch]].
4. **Every new persisted mutation key needs a matching `setMutationDefaults` registration** —
   enforced by `apps/mobile/src/utils/persistedMutationKeys.test.ts`. A key without a default
   silently no-ops on cold-start replay.
5. **`readStoredSession()` / storage access goes through `./client`'s re-export**, never a direct
   `import from './storage'` — tests mock `./client` wholesale and a direct `./storage` import
   drags `react-native` into the node test env.
6. On an **offline→online** edge, `NetworkProvider` fires `refreshSessionQuietly()` +
   `reconnectRealtime()` + `resumePausedMutations()` + `invalidateQueries()` (debounced 1s).
7. **A failed Keychain read is not a sign-out (v1.37.2).** iOS auth Keychain items use
   `SECURE_STORE_OPTIONS` (`AFTER_FIRST_UNLOCK`), the storage adapter never throws and serves a
   last-known-good value, and any code where a null session would gate a sign-out or the login
   screen must use **`readStoredSessionResult()`** and bail on `storageUnavailable`. The auto-refresh
   ticker is foreground-gated (`useSupabaseAutoRefresh`). See [[keychain-accessibility]].

## Key files

- `packages/api/src/session.ts` — `readStoredSession`, `getUserIdOfflineSafe`, `hasStoredSession`
- `packages/api/src/client.ts` — `AUTH_STORAGE_KEY` (derived, matches auth-js), `reconnectRealtime`, `refreshSessionQuietly`
- `apps/mobile/src/features/auth/utils/authSnapshot.ts` — 7-day window: `markVerified` / `offlineWindowState` / `extendOfflineWindow`
- `apps/mobile/src/features/auth/components/OfflineReauthGate.tsx` — the biometric extend screen (mounted in `app/_layout.tsx` `RootLayoutInner`, gated on `authStore.offlineReauthRequired`)
- `apps/mobile/src/features/auth/hooks/useAuthInit.ts` — the boot decision tree
- `apps/mobile/src/utils/mutationQueue.ts` — the separate offline queue persister

## Why

`jwt_expiry = 3600`. Before Phase 19, an hour into any offline session the token expired,
`getSession()` returned null, `useAuthInit` called `reset()`, and `AuthGate` redirected to a
login screen whose Turnstile WebView can't load without a network — a total lockout with valid
credentials sitting in the Keychain. Separately, the 24h query-cache `maxAge` silently discarded
the entire offline mutation queue if the app wasn't opened for a day.

Related: [[offline-ux-patterns]], [[commit-discipline]], [[hermes-intl-timezone-gap]].
