---
name: v1-37-2-batch
description: Use to answer "what's in v1.37.2" / "status of v1.37.2" / "how was Sentry REACT-NATIVE-M fixed", or before touching packages/api/src/storage.ts, the Supabase auth storage adapter, readStoredSession(Result), authSnapshot.ts, useAuthInit's boot/SIGNED_OUT paths, or expo-secure-store options. Records the v1.37.2 PATCH — a single-issue fix for the locked-device Keychain read.
---

# v1.37.2 — locked-device Keychain read (Sentry REACT-NATIVE-M)

**PATCH, OTA-eligible on the 1.37.1 runtime.** No native module, no plugin, no DB migration.
Not committed; no build yet. Tech Lead deploys.

## The bug

`REACT-NATIVE-M` (the only open Sentry issue): `Error: Calling the 'getValueWithKeyAsync'
function has failed → User interaction is not allowed` (`errSecInteractionNotAllowed`), an
unhandled rejection ~6 min after start, `in_foreground: false`, iOS. The Supabase auth storage
adapter (`packages/api/src/storage.ts`) called `expo-secure-store` with no options → iOS
`WHEN_UNLOCKED` default → the session blob is unreadable while the phone is locked. With
`autoRefreshToken: true` and no `AppState` gating, auth-js's ~30s refresh ticker keeps running
backgrounded; a tick on a locked device throws out of the un-`try/catch`'d adapter.

Latent second bug (a Phase 19-class lockout): `readStoredSession()` collapsed "read threw" into
the same `null` as "no session" → `offlineWindowState()` → `'no-credentials'` → login screen, and
the `SIGNED_OUT` handler's `.catch()` was dead code → hard sign-out.

## The fix

1. **`storage.ts`** — `SECURE_STORE_OPTIONS` (`AFTER_FIRST_UNLOCK`, Tech Lead call); adapter never
   throws; in-memory last-known-good cache served on a failed read; `lastSecureReadFailed(key)`.
   `authSnapshot.ts` writes through the same options.
2. **`session.ts`** — `readStoredSessionResult()` → `{ session, storageUnavailable }`;
   `readStoredSession()` kept as a thin wrapper (≈40 call sites untouched). Consumed by
   `offlineWindowState()`, `useAuthInit` boot (open from cache on `storageUnavailable && cached`),
   and the `SIGNED_OUT` handler (bail on `storageUnavailable`).
3. **`useSupabaseAutoRefresh`** — native-only `AppState` gate on `startAuthAutoRefresh`/
   `stopAuthAutoRefresh` (`client.ts` wrappers), mounted in `app/_layout.tsx` next to `useAuthInit()`.
4. **`keychainAccessibilityMigration.ts`** — iOS one-shot (MMKV flag `keychain_accessible_afu_v1`),
   delete + re-add the auth blob because `setItemAsync` on an existing key does NOT re-apply
   `kSecAttrAccessible`. Fired from `verifyInBackground()` after a verified load. Restores the old
   blob if the re-add fails.
5. **`sentry.ts` `beforeSend`** — drops events matching BOTH `getValueWithKeyAsync` and
   `User interaction is not allowed` (field builds + residual pre-first-unlock window).
6. `app.config.ts` `1.37.1` → `1.37.2`. Tests: api 13 → 16 green (utils 196 / mobile 187);
   typecheck 0.

## Remaining

iOS device test (install over a signed-in 1.37.1 → lock → wait past `jwt_expiry` → unlock →
expect still signed in, no new `REACT-NATIVE-M`); `git commit`; `eas update --branch production`;
resolve `REACT-NATIVE-M` in Sentry after the release is out.

Related: [[keychain-accessibility]], [[offline-session-durability]], [[v1-36-0-sentry-batch]].
