---
name: auth-native-google-signin
description: Reference for how Google Sign-In works in this app — native SDK (@react-native-google-signin/google-signin) with signInWithIdToken, not browser OAuth. Use when touching sign-in flows, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, google-services.json, or debugging why Google Sign-In needs a dev build.
---

# Native Google Sign-In

Google Sign-In was migrated from `expo-auth-session` + `expo-web-browser` (browser redirect) to `@react-native-google-signin/google-signin` (native account picker) with `supabase.auth.signInWithIdToken`.

**Why:** Browser-based OAuth redirected to localhost on Android, causing a "Verbindung fehlgeschlagen" error. The native SDK avoids browser redirects entirely.

**How to apply:**
- The app requires a development build (not Expo Go) because `@react-native-google-signin/google-signin` has native modules.
- `apps/mobile/app.config.ts` (dynamic config, replaces `app.json`) includes the google-signin plugin + `google-services.json` reference.
- `apps/mobile/google-services.json` comes from Firebase Console, linked to GCP project `vacationist`.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` env var is required.
- EAS Build is configured: `npm run build:dev` for a development APK.
- Web platform still uses browser-based OAuth (unchanged).

Related hooks:
- `useGoogleSignIn` — platform-aware sign-in (native on mobile, browser on web)
- `useSignOut` — synchronized Supabase + Google SDK sign-out

See also [[release-v1-history]] for the production SHA-1 signing bug this flow hit after the first Play Store release, and [[sdk-upgrade-55]] for the Expo SDK bump this migration forced.
