---
name: release-v1-history
description: Reference for the two auth bugs hit on the first Play Store release (v1.0.0 to v1.0.1) — Google Sign-In SHA-1 mismatch from Play App Signing, and magic link failing on Android due to implicit-flow hash fragments. Use when debugging production auth/signing issues or magic links.
---

# v1.0 release history — auth bugs and fixes

v1.0.0 was submitted to the Play Store internal testing track, then patched to v1.0.1.

**Why:** The first public release hit two auth bugs on the production Play Store build.

**How to apply:** Reference when debugging future auth or signing issues.

### Bug 1: Google Sign-In failed on production
- Play Store uses Google Play App Signing — Google re-signs the APK with their own key.
- The SHA-1 in `google-services.json` matched the EAS upload key, not the Play Store app signing key.
- Fix: Get the app signing SHA-1 from Play Console → Setup → App integrity → App signing key certificate, add a new Android OAuth client in GCP, re-download `google-services.json`, rebuild.

### Bug 2: Magic link did nothing on Android
- Root cause 1: Supabase's implicit flow puts tokens in the URL hash (`#access_token=...`); Android Chrome strips hash fragments when redirecting to custom schemes, so the app received `vacationist://` with no tokens.
- Root cause 2: Gmail on PC pre-fetches/scans magic link URLs, consuming the one-time OTP token before the user clicks it.
- Fix: Switch the Supabase client to PKCE flow (`flowType: 'pkce'` in `client.ts`). PKCE uses a `?code=...` query string, which Android preserves reliably. Also updated `setSessionFromUrl` to call `supabase.auth.exchangeCodeForSession(code)` and updated the web URL handler to detect the `code=` param.
- Shipped as an OTA update to the production branch (no Play Store review needed).
- Users must open the magic link directly from the email app on their phone — copying it through Gmail on PC invalidates the token.

### Play Store SHA-1 fingerprint location
Play Console → (app) → Release → Setup → App integrity → App signing tab → "App signing key certificate" section.

See also [[auth-native-google-signin]] for the sign-in architecture this bug was found in.
