---
name: keychain-accessibility
description: Use before touching packages/api/src/storage.ts, the Supabase auth storage adapter, expo-secure-store options anywhere, or any code that reads the stored session to decide sign-out / show the login screen. iOS SecureStore has a locked-device gotcha (Sentry REACT-NATIVE-M, fixed v1.37.2) that is easy to reintroduce.
---

# iOS SecureStore / Keychain accessibility (v1.37.2)

## The rules

1. **Every auth-related `expo-secure-store` call passes `SECURE_STORE_OPTIONS`**
   (`packages/api/src/storage.ts`, exported from `@vacationist/api`) — `AFTER_FIRST_UNLOCK`.
   Never call `setItemAsync`/`getItemAsync` for an auth item with no options: the default is
   `WHEN_UNLOCKED`, which throws `errSecInteractionNotAllowed` ("User interaction is not allowed")
   the instant the item is touched while the device is locked.
2. **The storage adapter must never throw.** `@supabase/supabase-js` auth-js does not catch
   storage errors — an un-caught rejection escapes as an unhandled promise rejection → Sentry.
   The adapter swallows the error and returns an in-memory last-known-good value.
3. **A failed Keychain read is NOT "signed out".** Use
   `readStoredSessionResult(): { session, storageUnavailable }` — not bare `readStoredSession()` —
   anywhere a `null` session would trigger `reset()`, `clearAuthSnapshot()`, or a redirect to the
   login screen. Bail on `storageUnavailable`. Consumers today: `offlineWindowState()`,
   `useAuthInit` boot branch + `onAuthStateChange('SIGNED_OUT')` handler.
4. **auth-js's auto-refresh ticker is foreground-gated.** `useSupabaseAutoRefresh`
   (`apps/mobile/.../hooks/useSupabaseAutoRefresh.ts`) drives
   `startAuthAutoRefresh()`/`stopAuthAutoRefresh()` off `AppState`. `autoRefreshToken: true` alone
   runs a ~30s ticker forever, including backgrounded on a locked phone.
5. **Changing the accessibility of an EXISTING key requires delete + re-add.**
   `SecureStore.setItemAsync` on a key that already exists issues a bare `SecItemUpdate`
   (`kSecValueData` only) — `kSecAttrAccessible` is only applied on a fresh `SecItemAdd`. See
   `keychainAccessibilityMigration.ts` (iOS, one-shot, MMKV flag `keychain_accessible_afu_v1`,
   restores the old blob if the re-add fails). This is why an options-only change silently fixes
   nothing for installed users.

## Why

Sentry `REACT-NATIVE-M`: `getValueWithKeyAsync` failed with "User interaction is not allowed",
`mechanism: onunhandledrejection`, `in_foreground: false`, iOS. The auth storage adapter used
expo-secure-store defaults (`WHEN_UNLOCKED`) and had no `try/catch`; the always-on auto-refresh
ticker hit the Keychain on a locked, backgrounded device. Beyond the noise, `readStoredSession()`
collapsed "read threw" into the same `null` as "no session", so a locked read could cascade into a
hard sign-out / the offline-unloadable login screen — the exact [[offline-session-durability]]
lockout Phase 19 fixed for the token-expiry case.

## Accessibility level choice

`AFTER_FIRST_UNLOCK` (not `_THIS_DEVICE_ONLY`) — keeps today's behaviour of migrating the session
to a new device via an encrypted backup, which `useAuthInit`'s `minimalUser` path already assumes
("fresh install from a device backup"). Tech Lead call, v1.37.2.

Related: [[offline-session-durability]], [[v1-37-2-batch]], [[commit-discipline]].
