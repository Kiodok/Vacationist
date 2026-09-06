---
name: v1-35-0-batch
description: Use to answer "what's in v1.35.0" / "status of v1.35.0", or before touching the Nudge feature on web, NudgeSheet, trip settings notification section, any web-reachable Alert.alert, Supabase auth / sign-in / sign-out / account-deletion flows, useAuthInit, the apps/mobile/modules/ native modules, or anything about Android Zero-Tap Sign-In / Restore Credentials. Records the v1.35.0 release: Nudge-on-web + the Play Console 2027 technical-quality requirements (Android Restore Credentials API for Zero-Tap Sign-In; memory/DEX = measure only).
---

# v1.35.0 batch

`app.config.ts` at `1.35.0`. Straight onto `main` ([[no-branches-main-only]]). **Ships the first
local native module in the repo → full Play Store + App Store build, NOT OTA.** `npm run
typecheck` + `npm test` (root) green. Plan:
`C:\Users\Gary\.claude\plans\polymorphic-mixing-orbit.md`.

Two unrelated drivers: (1) enable "Send a Nudge" on web now Web Push is live (v1.34.0); (2) the
Play Console technical-quality requirements announced 2026-08 — Zero-Tap Sign-In (Android
Restore Credentials API, enforced **April 2027**) and memory/DEX thresholds (enforced **Feb
2027**), both Android-only.

## Item 1 — Nudge on web (code-complete)

- **`NudgeSheet.tsx`** — `Alert.alert` confirm → inline per-row confirm (`pendingKey` state).
  `Alert.alert` is a hard no-op on `react-native-web` (`class Alert { static alert() {} }`) —
  unhiding the button without this would ship a button that does nothing. Colorful-safe
  (`useResolvedTheme`, `colors.surface` text on `bg-primary`, web `boxShadow`).
- **`app/trip/[id]/settings.tsx`** — dropped `Platform.OS !== 'web' &&` from the organizer Nudge
  card (kept `isOrganizer &&`) **and** `<NotificationPreferencesSection>` (web users receive Web
  Push and must be able to toggle "Reminders & nudges"). Server side (`send_organizer_nudge` RPC,
  set-based fanout, `push-notification` Edge Function) was already platform-agnostic — no change.
- **Alert.alert sweep** — `TravelDocumentCard.tsx` delete confirm → inline; `profile.tsx` avatar
  + delete-account alerts → `useToastStore`. `overview.tsx` (calendar) and `BiometricGate.tsx`
  LEFT AS-IS — already behind a `Platform.OS !== 'web'` / web-bypass guard, never run on web.
  Don't "fix" them.
- `usePushNotificationHandler.web.ts` stale comment corrected. `sw.js` `resolvePath()` has no
  `nudge` branch → falls through to `/trip/<id>` (correct — leave it).
- **Owed:** browser verification (`npm run web`, organizer → Settings → send nudge → push lands),
  4-theme QA.

## Item 2a — Zero-Tap Sign-In / Android Restore Credentials (code-complete, NOT deployed)

**Flow:** sign-in → `restore-credential` EF `register-options` (authed) → native
`createRestoreKey` → `register-verify` → row in `restore_credentials`. New device, no session →
`auth-options` → native `getRestoreKey` → `auth-verify` (verifies ES256 assertion) →
`generateLink({type:'magiclink'})` (**no email sent**) → returns `hashed_token` → client
`verifyOtp({type:'magiclink'})` → session. **Guests (no email) cannot be restored — only full
accounts get a key.**

- **Migration `20260906120000_create_restore_credentials.sql`** — `restore_credentials`
  (`user_id ON DELETE CASCADE`) + `restore_credential_challenges` (`user_id ON DELETE SET NULL`,
  single-use, 2-min TTL) + daily prune cron. RLS **deny-all** for anon/authenticated on both
  (same as `analytics_events`). No SECURITY DEFINER RPC. **`delete_own_account()` needs NO
  change** (CASCADE + SET NULL) — verify with the `pg_constraint` query after applying.
- **Types** — `RestoreCredential` (`database.ts`), 5 opaque-JSON Zod schemas (`schemas.ts`).
  `database.types.ts` NOT regen'd yet (client doesn't touch the tables directly) — run
  `npm run supabase:types` before the release build.
- **`packages/api/src/restoreCredentials.ts`** — `getRestoreRegistrationOptions`,
  `verifyRestoreRegistration`, `getRestoreAuthenticationOptions`, `verifyRestoreAuthentication`,
  `deleteRestoreCredential`, `signInWithRestoreTokenHash`. Explicit `Authorization` header on
  authed calls (don't trust `functions.invoke` implicit injection — Phase 14 lesson).
- **Edge Function `supabase/functions/restore-credential/index.ts`** — `action`-dispatched.
  `jsr:@simplewebauthn/server@13`. `verify_jwt = false` in `supabase/config.toml` → deploy with
  `--no-verify-jwt`. NO CORS (native-only caller; an Origin allowlist would break the no-Origin
  native request). `rpId = 'vacationist.app'` (`assetlinks.json` already has
  `common.get_login_creds`). `expectedOrigin` = `android:apk-key-hash:<Play App Signing cert
  hash>` (`FOizwfJx0qKH82cPicZt7WotWIJ7bx_37fC96H9TtIk`, same fingerprint as `assetlinks.json`;
  `RESTORE_EXTRA_APK_KEY_HASHES` env for an EAS upload keystore).
- **Native module `apps/mobile/modules/expo-restore-credentials/`** — **first local native
  module in the repo.** `expo-module.config.json` declares only `android`. Kotlin over
  `androidx.credentials:credentials(-play-services-auth):1.5.0`. JS side:
  `requireOptionalNativeModule` + `Platform.OS === 'android'` guard → iOS/web = no-op.
  **BackupAgent / `onRestoreFinished()` deliberately out of scope.**
- **`apps/mobile/src/features/auth/utils/restoreCredential.ts`** — `restoreCredentialSupported`,
  `ensureRestoreKey` (fire-and-forget post-sign-in, MMKV flag
  `restore_credential_registered_v1`), `attemptRestoreSignIn` (cold start, runs in `useAuthInit`
  **while the splash is still up** so a success never flashes login), `clearRestoreKey`.
- **Integration** — `useAuthInit.ts` (`attemptRestoreSignIn` before `reset()`;
  `ensureRestoreKey` in both profile-load success paths), `useSignOut.ts` (chained with
  `unregisterWebPushAsync` before `signOut()`), `useDeleteAccount.ts`. Post-restore FCM
  re-register is covered by the existing `[hasSession, userId]` effect in `_layout.tsx`.
- **DEPLOYED 2026-09-06** (approved exception to "migrations must not get ahead of the client" —
  brand-new deny-all tables, nothing existing reads them): migration `20260906120000` + Edge
  Function on **dev + prod**, ledger parity confirmed, `supabase:types` regenerated, smoke-tested
  (`auth-options` → challenge; `register-options` w/o JWT → 401; unknown credential → error).
- **Owed:** `RESTORE_EXTRA_APK_KEY_HASHES` secret if the EAS keystore ≠ Play App Signing;
  **device test = restore via Google backup / D2D transfer, NOT a same-device reinstall**; full
  store builds; commit.

## Item 2b — Memory / DEX (Feb 2027) — NO code change

R8 already runs (`enableProguardInReleaseBuilds` + `enableShrinkResourcesInReleaseBuilds` in
`app.config.ts`); DEX requirement only applies if DEX > 10 MB. Owed: production-AAB
`apkanalyzer dex packages` + `adb shell dumpsys meminfo` baseline. `expo-image` migration
explicitly NOT done. Turnstile WebView is login-screen-only (unmounted after sign-in) → the
background-retention concern doesn't apply.

## Docs

`docs/privacy-policy.html` + `marketing/site/content/de/legal/privacy-policy.md` — Android
restore-credential disclosure; site rebuilt twice (deterministic). `engineering/implementation_guide.md`
Phase 17; `engineering/supabase.md` 2026-09-06 entry w/ deploy checklist; CLAUDE.md "Native
modules" note. `docs/delete-account.html` NOT touched (`delete_own_account()` unchanged).

## Related

[[no-branches-main-only]], [[commit-discipline]], [[no-docker-on-machine]],
[[edge-function-redeploy-after-edit]], [[v1-34-2-batch]], [[marketing-site-build]],
[[android-runtime-resource-shrinking]], [[auth-native-google-signin]].
