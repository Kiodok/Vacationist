# Supabase Changes Log

## 2026-08-10 — iOS build prep: Sign in with Apple + token revocation (migration + 2 Edge Functions)

**Why:** Apple Developer Program enrollment completed; first iOS build in progress. Google
Sign-In is the app's prominent social login, which puts it under App Store Guideline 4.8
(apps offering third-party social login must offer an equivalent privacy-preserving option) —
Tech Lead decision was to add Sign in with Apple now rather than risk rejection.

**Migration:** `20260810100000_create_apple_signin_tokens.sql` (additive-only, applied to dev
then prod same day). Creates `public.user_apple_tokens` (encrypted refresh-token storage, no
PostgREST-reachable client access — RLS blocks all direct DML, SELECT-own is a safety net
only), a dedicated `apple_signin_token_encryption_key` vault secret (independent of
`travel_documents_encryption_key` — different rotation concerns), and three SECURITY DEFINER
RPCs: `store_apple_refresh_token`, `get_own_apple_refresh_token`,
`delete_own_apple_refresh_token`.

**Why a whole token-storage table:** App Review Guideline 5.1.1(v) requires revoking the
user's Apple token on account deletion. Revocation needs a `refresh_token`, only obtainable by
exchanging the native sign-in's single-use `authorizationCode` — that exchange must happen at
sign-in time (the code expires in minutes) and the result persisted until whenever the user
eventually deletes their account, which could be months later.

**Edge Functions (deployed to dev + prod):**
- `apple-token-exchange` — called once, right after a fresh native Apple sign-in
  (`useAppleSignIn.ts` / `useGuestUpgrade.ts`), exchanges the `authorizationCode` for a
  `refresh_token` via Apple's `/auth/token`, stores it encrypted. Best-effort — sign-in has
  already succeeded via `signInWithIdToken` before this runs.
- `revoke-apple-token` — called from `useDeleteAccount.ts` right before `deleteOwnAccount()`.
  Reads the caller's own encrypted token, revokes it via Apple's `/auth/revoke`, then deletes
  the stored row. No-ops (204) cleanly if the caller never linked Apple. Deliberately NOT
  folded into `delete_own_account()` itself — kept as a separate client-driven pre-step so that
  function (already carefully patched more than once, see the Account Deletion section in
  CLAUDE.md) stays untouched.
- Both share `supabase/functions/_shared/appleClientSecret.ts` — mints a fresh ES256-signed
  Apple client-secret JWT per invocation (5 min expiry, never cached), from `APPLE_TEAM_ID` /
  `APPLE_KEY_ID` / `APPLE_CLIENT_ID` / `APPLE_PRIVATE_KEY` secrets set on both projects.
  `APPLE_CLIENT_ID` is the app's **bundle ID** (`com.vacationist.mobile`), not the Services
  ID — native `AuthenticationServices` sign-in mints tokens with `aud` = bundle ID, unlike the
  web OAuth redirect flow (which this app doesn't use for Apple).
- Both left at the platform default `verify_jwt = true` (no `config.toml` override), same
  posture as `attribution-capi` — re-derive identity via `auth.getUser(jwt)` too, since
  `verify_jwt` alone would also pass a request bearing only the publishable key.

**Dashboard config (not in this repo, done directly):** Apple provider enabled on both
Supabase projects (Auth → Providers → Apple), Client IDs allow-listing both the Services ID
(`com.vacationist.mobile.signin`) and the bundle ID (`com.vacationist.mobile` — the one the
native flow actually validates against), redirect callbacks pointed at both projects'
`/auth/v1/callback`. `supabase/config.toml`'s `[auth.external.apple]` block updated to match,
documentation-only per this repo's existing convention (`supabase config push` is never run
against this project — see the 2026-07 CAPTCHA entry).

**Also this pass (zone config, no migration):** `docs/.well-known/apple-app-site-association`
added for iOS Universal Links (`/join*` → native app). Served via a new Transform Rule
(`aasa_content_type`, ruleset `4722ba5424cc4b409525deabe507800a` v3 → v4) forcing
`Content-Type: application/json` on that one path — GitHub Pages serves extensionless files as
`application/octet-stream` by default, which Apple's AASA fetcher rejects. Existing
`security_headers_for_audit` rule (same ruleset) left untouched.

**Verification:** `npm run typecheck` and `npm test` (root) both clean after all of the above.
Live device verification (Sign in with Apple end-to-end, revoke-on-delete, AASA fetch) pending
the first iOS build.

**Follow-up same day — `20260810110000_fix_apple_token_key_missing_signal.sql` (dev + prod):**
code review on the pass above caught that `get_own_apple_refresh_token()` returned `NULL` for
both "caller never linked Apple" and "encryption key unavailable" — `revoke-apple-token` had no
way to tell an operational fault apart from the normal case, so a key outage would silently
produce 204s with no signal that 5.1.1(v) revocation was failing. Fixed to `RAISE EXCEPTION`
when the key is missing; the Edge Function's existing rpcError-vs-null branching (unchanged)
now actually distinguishes the two.

## 2026-08-10 — Cloudflare CSP `connect-src` was blocking all real browser analytics traffic (zone config only, no migration)

**Why:** Tech Lead reported two Reddit campaign IDs (`2548274834651639088`, `2565002991285116998`)
never showing up in `scripts/analytics-report.mjs`'s "Top campaigns" table.

**Root cause:** not a dashboard bug — no real browser visitor's `page_visit`, click, or
attribution event had reached `analytics_events` at all since Phase 14 shipped (2026-08-08).
Querying prod directly: 12 rows in the last 30 days, and every row carrying a non-null
`rdt_cid` was one of the manual `curl` verification tests from the 2026-08-08/09 entries below
(`verify_test_456`, `test_click_123`), not real traffic.

The `vacationist.app` zone's `Content-Security-Policy` header (set via the
`security_headers_for_audit` Transform Rule, `http_response_headers_transform` phase — see the
2026-08-06 entry below for the header pipeline this belongs to) has an explicit `connect-src`
that never included `https://fsfsqghbejwvgxujoyne.supabase.co` — the endpoint
`marketing/site/track.js` calls via `fetch()` for every `page_visit`/click/attribution event.
Because `connect-src` is explicitly declared (no `default-src` fallback applies), every
CSP-enforcing browser silently blocked the request — no console-visible error reaches our
tooling, no server-side signal either, which is why this went unnoticed: the only verification
ever done against `track-event` was via `curl` (explicitly noted in the 2026-08-08 entry below),
and `curl` isn't subject to a page's CSP. Native app sign-ups were unaffected (go through
`attribution-capi` from the mobile app, not a browser page, so no CSP applies).

**Also found while investigating:** the same `connect-src` gap (plus a missing `script-src`
entry) was independently blocking Cloudflare's own Web Analytics (RUM) beacon
(`static.cloudflareinsights.com`) — enabled on this zone since 2026-07-13, recording zero
events despite real edge traffic (745–5,032 requests/day in the retained window).

**Fix (Cloudflare zone Transform Rule, not a repo change):** added
`https://fsfsqghbejwvgxujoyne.supabase.co` and `https://static.cloudflareinsights.com` to
`connect-src`, and `https://static.cloudflareinsights.com` to `script-src`. Purely additive —
no existing directive or origin removed. Rule `d70a9fa501ca4423b96195184a5eb0f8` in ruleset
`4722ba5424cc4b409525deabe507800a`, version 2 → 3. Verified live via
`curl -sI https://vacationist.app/` immediately after.

**Not yet verified:** that a real browser visit now successfully posts to `track-event`
end-to-end (would need a live test visit with dev tools open, or waiting for real traffic and
re-checking `analytics_events`). **Not addressed:** whether the two named Reddit campaigns'
destination URLs actually carry a `utm_campaign` query parameter — nothing in this codebase
derives `utm_campaign` from Reddit's own numeric campaign ID automatically, so even with the
CSP fixed, a campaign only appears by name in "Top campaigns" if Reddit Ads Manager's URL
parameter template was configured to send one. Without it, that traffic still lands correctly
(bucketed as "Reddit (paid)" via `rdt_cid` in the Funnel-by-source chart) but won't be named in
the campaigns table. Worth the Tech Lead confirming in Reddit Ads Manager.

**Non-destructive** (zone header config only, no schema/data change, no repo change). Applied
to: `vacationist.app` Cloudflare zone (2026-08-10).

---

## 2026-08-09 — Bot registrations via web Google Sign-In: restored the client-side captcha gate (code-only, no migration)

**Why:** Tech Lead reported bot registrations on Web again — real bulk-registered Gmail
accounts (`namexy.12345@gmail.com` pattern, genuine `lh3.googleusercontent.com` avatars),
arriving while a paid Reddit ad campaign is running.

**Root cause, traced through the actual code, not the widget-mode change that got the
initial attention:** `c608f55` (same day, entry above) made two changes at once. The
`invisible` mode switch was one of them, but the actual regression is the other half —
`login.tsx` used to render the Google button only after `captchaReady`:

```tsx
{captchaReady ? (
  <><GoogleAuthButton ... /> ...</>
) : !captchaError ? (
  <ActivityIndicator ... />
) : null}
```

That gate was removed; the button became interactive from first paint on every platform.

This matters specifically for web because **the web Google path has no server-side CAPTCHA
at all, and never has** — confirmed this session:
- `curl 'https://fsfsqghbejwvgxujoyne.supabase.co/auth/v1/authorize?provider=google&redirect_to=...'`
  → `302` straight to Google's consent screen, no token required, no app UI involved.
- `useGoogleSignIn.ts` (web branch): `signIn()` ignores its `captchaToken` argument entirely
  and does `window.location.href = url` — the token `useCaptchaToken.getToken()` fetches is
  never forwarded. `supabase.auth.signInWithOAuth` has no `captchaToken` option in the first
  place; Supabase's docs confirm CAPTCHA protection covers only the sign-in/sign-up/password-reset
  *forms*, not OAuth redirects, and no rate limit is documented for `/authorize` either.

Every other signup path **was and is** server-verified — confirmed by `curl` against both
dev and prod, both returning `{"error_code":"captcha_failed"}` for missing and for garbage
tokens: native Google (`signInWithIdToken` + `captchaToken`), magic link on both platforms
(`signInWithOtp` + `captchaToken`), and guest sign-in on both platforms
(`signInAnonymously` + `captchaToken`). So the removed client-side gate was the *only*
protection the web Google button ever had.

(The `invisible` mode switch itself is unrelated to this bug and stays as-is — confirmed
live on `web.vacationist.app/login` that the widget still delivers a valid token silently
within a couple seconds of page load; a `managed` revert would only add friction to paths
that were never the hole.)

**Fix:** `useCaptchaToken.ts` gained a sticky `passed` flag (true from the first delivered
token onward, never reset by `consumeToken()` — unlike `tokenRef`, which is cleared after
every submit). `login.tsx` gates the Google button (and its divider) behind
`Platform.OS !== 'web' || captcha.passed`, showing the same fixed-height spinner
placeholder the pre-`c608f55` code used while waiting, so there's no layout jump.

**Deliberately scoped to web only:**
- Native Google sign-in is untouched — it already has a server-verified token via
  `signInWithIdToken`, so a client gate adds no security, only latency (and would have
  reintroduced the exact WebView hang the `invisible` switch was fixing, per the Oukitel
  WP28 report that prompted this session).
- Magic-link and guest controls stay ungated on both platforms — already server-verified.
- `GuestUpgradeSheet`'s Google upgrade path needs no change: `useGuestUpgrade.upgradeWithGoogle`
  returns early when `GoogleSignin` is null, which is always true on web, so it never reaches
  `/authorize`.
- No change to the Turnstile widget config (mode, domains) or to Supabase Attack Protection.

**Residual risk, not addressed this session:** this restores a *client-side* gate only —
`/authorize` itself stays publicly reachable to anything that skips the UI. The same gate
held from launch until 2026-08-09, so the bar is empirically reasonable, but if bots start
hitting `/authorize` directly the next escalation is Supabase's **Before User Created**
auth hook (confirmed available on this project's plan, confirmed to fire for OAuth
signups — payload includes `app_metadata.provider`, `user_metadata`, and
`metadata.ip_address`) as the only server-side enforcement point Supabase offers for this
path. Not implemented now — no rejection heuristic (email-pattern, IP-velocity) has been
agreed on, and building the hook without one ready to configure isn't useful yet.

Existing bot accounts were not cleaned up this session — each already triggered
`trg_create_example_trip` (a full demo trip write across ~20 tables), and `auth.admin.deleteUser`
bypasses `delete_own_account()`'s sentinel reassignment, so bulk deletion will hit the same
non-cascading-FK class of failure that function exists to handle. Needs a read-only audit
pass first.

**Verified:** `npm run typecheck` exits 0; `npm test` passes (229 tests across
`apps/mobile`, `packages/utils`, and the marketing-site consent suite). Live-verified via
`npm run web` + Chrome on `localhost:8081/login`: on fresh load the Google button and its
divider are absent (only "Vacationist / Group Trip Planner / Send Magic Link" render), the
magic-link field and button are interactive immediately, and the Google button appears
(`aria-label="Sign in with Google"`) within ~1s once the invisible widget resolves. Not yet
device-verified — still needs a preview build check that native Google sign-in is unaffected
(expected, since no native code path changed).

**Unrelated pre-existing issue found and fixed while verifying this session:** the web dev
server (`npm run web` / `npm run start`) was broken — Metro failed with `Unable to resolve
module @expo/metro-runtime` and then, after a stray manual fix attempt, with `Invalid call...
process.env.EXPO_ROUTER_APP_ROOT`. Root cause: `packages/api`'s `expo-crypto`/`expo-secure-store`
declare `"expo": "*"` as a peer dependency; since they're dependencies of a workspace other
than `apps/mobile`, npm couldn't see `apps/mobile`'s `expo@55.0.28` to satisfy that peer and
silently installed a second, phantom `expo@57.0.11` tree at the workspace root instead
(reproduced identically from a from-scratch `npm install`, confirming it predates this
session — not something this session's edits caused). Metro then picked up the mismatched
SDK-57 `@expo/router-server`/`babel-preset-expo` in some resolution paths, breaking the
`require.context(process.env.EXPO_ROUTER_APP_ROOT, ...)` transform. Fixed with an `overrides`
entry in the root `package.json` (`"expo": "^55.0.28"`) forcing a single deduped version
tree-wide, followed by a full `node_modules` + `package-lock.json` regeneration. Verified via
`npm ls expo` (single `55.0.28`, no `invalid` markers), `npm run typecheck` (exit 0), and
`npm test` (229 tests). Not migration-related, but worth knowing if `npm run start` breaks
again after adding a new dependency to `packages/api` or `packages/utils` with a loose `expo`
peer range.

**Second-order regression from the fix above, caught on-device (Tech Lead's Oukitel WP28):**
regenerating `package-lock.json` also re-resolved two OTHER unpinned dependencies to whatever
was newest on npm today, both of which are native modules whose compiled binary is baked into
the already-built dev-client APK on-device — a JS-level `npm install` cannot update them:
- `react-native-nitro-modules` (a transitive dep of `react-native-mmkv`, declared as `"*"` by
  mmkv) moved `0.35.7` → `0.36.5`, producing the "native Nitro Modules core runtime version
  is 0.35.7, but the JS code is using version 0.36.5" warning.
- `react-native-mmkv` itself moved `4.3.1` → `4.3.2` (still within `apps/mobile/package.json`'s
  unpinned `^4.3.1`), and 4.3.2's JS wrapper (`addContentChangedListener.js`) calls a native
  method (`checkContentChanged`, added in `HybridMMKV.cpp`) that doesn't exist in whatever
  mmkv version the current dev-client binary was actually compiled against — crashing with
  `TypeError: mmkv.checkContentChanged is not a function`.

Fixed by pinning both back to exactly what the pre-session lockfile (backed up before the
first regeneration) had resolved — `react-native-nitro-modules: "0.35.7"` and
`react-native-mmkv: "4.3.1"` — added to the same root `package.json` `overrides` block as
`expo`, followed by another full `node_modules` + `package-lock.json` regeneration. `npm ls`
confirms all three now resolve to a single version each, tree-wide, with no `invalid`
markers; `npm run typecheck` and `npm test` (229 tests) both clean.

**General lesson, not just this instance:** a full lockfile regeneration in this monorepo is
not safe by default — any dependency with an unpinned/wildcard range (`"*"`, or a `^range`
that's drifted since the lockfile was last generated) can silently jump to a newer version,
and for **native modules** (anything with compiled Android/iOS code — Nitro-based packages,
`expo-*` native modules, etc.) that JS-level version bump has no matching native binary until
the next actual build. A plain `npm install`/`typecheck`/`npm test` pass looks completely
clean in this failure mode — the break only surfaces at runtime on a real device. The three
overrides now in root `package.json` pin the packages this session found drifting; if a
`node_modules` wipe is ever needed again, diff the resulting `package-lock.json` against the
previous one for any OTHER native-module version changes before trusting it on-device, not
just the ones already known to be pinned here.

App version intentionally left at `1.29.3` — JS-only change, OTA-eligible, no version bump
requested.

---

## 2026-08-09 — Google Play Data Safety rejection: account-deletion URL + declaration audit (docs-only, no migration)

**Why:** v1.29.1 was rejected by Google Play under the User Data policy's Data safety section —
invalid form. Google's notice named the **email address** as an undeclared collected data type,
and separately required the "Konto-URL löschen" (account deletion URL) field in Play Console,
which was empty. Full requirements confirmed against
[Google's account deletion policy page](https://support.google.com/googleplay/android-developer/answer/13327111):
the web resource must be functional, reference the developer/app name shown on the store listing,
prominently show deletion steps, work without re-installing the app, and state what's deleted vs.
retained plus any extra retention period.

**Root cause:** Vacationist already has a complete in-app deletion path
(`apps/mobile/app/(tabs)/profile.tsx` → `useDeleteAccount` → `delete_own_account()` RPC), but no
corresponding **web** resource — Play requires both, not just the in-app one. Separately, an audit
of the Android bundle (prompted by the "undeclared data" wording) found the Data Safety form was
very likely also missing declarations for Sentry (crash/session-replay, always-on, no consent
gate), Cloudflare Turnstile (auth-flow anti-abuse), and the Reddit Conversions API sign-up report
fired from native (`trackSignUp.ts`, no on-device consent gate on Android — `ConsentBanner` is
`Platform.OS === 'web'`-only).

**Fix — documentation and marketing-site changes only, no app code touched, no new build, no
migration:**

- New `docs/delete-account.html` (EN, hand-authored, carries `consent.js`) and
  `marketing/site/content/de/legal/delete-account.md` (DE, generated to `/de/delete-account/`) —
  three deletion routes (in-app, web.vacationist.app, email), and an explicit breakdown of what
  `delete_own_account()` actually destroys vs. anonymizes-and-retains on shared trips.
- Wired into `marketing/site/build.mjs`: sitemap entry with EN/DE/x-default hreflang, and
  `FOOTER_LINKS.en.legal` / `.de.legal` (appears on all 36 generated pages). Footer link also
  added by hand to `docs/index.html`, `docs/privacy-policy.html`, `docs/terms-of-service.html`,
  `docs/impressum.html` (plus `docs/i18n/en.js` / `de.js` keys and a `CACHE_VER` bump in
  `docs/i18n.js`).
- Corrected `docs/privacy-policy.html` §7/§8 (and the German counterpart) — the prior text claimed
  "all personal data … permanently deleted within 30 days" with no mention of the anonymized
  retention on shared trips, which doesn't match `delete_own_account()`'s actual behavior. Now
  links to `/delete-account.html`. Pre-existing inaccuracy, not introduced by this change.
- New `engineering/play_data_safety.md` — the full audited data-flow table (7 flows, what's
  collected, what's shared, with whom, for what purpose) mapped onto Play's Data Safety taxonomy,
  plus the exact Play Console steps. Two items flagged for a Tech Lead call rather than resolved
  here: whether Sentry session-replay/screenshot capture on the travel-documents screen needs
  masking, and whether the native Reddit CAPI report needs a consent gate for GDPR (separate from
  Play's requirement, which is satisfied by honest declaration alone).
- `CLAUDE.md` updated: the hand-authored consent.js page count is now 8 (added
  `docs/delete-account.html`), and the Account Deletion section now cross-references the new
  disclosure pages so future changes to the sentinel-reassignment list stay in sync.

**Verified:** `npm run build:site` run twice with zero diff on the second run; new pages and footer
links checked in-browser at `localhost:3001` (light/dark not applicable — marketing site is a
fixed dark theme); consent-gating on `/delete-account.html` confirmed via `read_network_requests`
(no GA request before accepting the cookie banner). No migration was applied — dev/prod schema
parity is unaffected. `apps/mobile`, `packages/*`, and `supabase/` were not touched, so no build or
OTA update is required; the v1.29.1 binary is resubmitted to Play Console as-is once the Tech Lead
completes the manual form entry in `engineering/play_data_safety.md`'s final section.

---

## 2026-08-09 — Turnstile fallback stability fixes (code-only, no migration)

**Why:** Tech Lead ran the invisible-mode + real-origin fix (entry directly below) on a physical
Android device and found three real problems:

1. After the browser fallback resolved and returned to the app, the Google button had to be
   tapped a **second time** to actually open the account picker — the first tap only fetched the
   token.
2. After signing out and trying again, verification **always failed until a full app restart**.
3. On one attempt, the browser fallback opened `web.vacationist.app/captcha-redirect` and **hung
   indefinitely** on "Verifying…" with no way to recover short of closing the tab — and closing it
   didn't help either.

**Root causes, traced through the actual code (not guessed):**

1. `useCaptchaToken.getToken()` deliberately returned `undefined` the instant it kicked off the
   browser fallback, by design (see the entry below) — the caller's submit handler just stopped,
   so nothing auto-continued when the fallback later resolved. **This was a considered decision at
   the time** (avoiding an auto-resume across an Android background/foreground cycle), but real
   device testing showed the resulting "tap again" step is worse UX than the fragility that
   decision was trying to avoid.
2. `captchaFallbackStore`'s `FALLBACK_COOLDOWN_MS` (60s) blocked **any** new fallback attempt for
   60 seconds after the *previous* one — including a fully successful one, since nothing ever
   reset `lastFallbackAt`. Combined with (3) below, a user who signed out and retried within that
   window got silently blocked (`startCaptchaBrowserFallback` returning `'cooldown'` with no
   browser opening) on every attempt until the in-memory Zustand store was wiped by a process
   restart — exactly "always fails until app restart." The cooldown was written as a "remount
   storm" circuit breaker from when the fallback could still be triggered automatically; that
   trigger path no longer exists (it's exclusively a submit-time user action now), and the
   existing `status === 'pending'` guard already fully prevents two Custom Tabs opening at once —
   so the cooldown was redundant with a correct guard and only added the harmful blocking.
3. `login.tsx` / `join.tsx` / `GuestUpgradeSheet.tsx` only called `consumeToken()` (which resets
   `failedRef` and remounts the embedded widget) inside the `finally` around an *actual* sign-in
   attempt — never on the "not ready yet, fallback just started" early-return branch. So after a
   failed/blocked attempt, the embedded widget was never given a fresh mount and stayed marked as
   already-failed, compounding with (2).
4. `apps/mobile/app/(auth)/captcha-redirect.tsx` (the fallback's target page) had **zero timeout
   handling** — if the invisible Turnstile challenge there hung (no token, no error, ever), the
   page just sat on "Verifying…" forever with no retry affordance.

**Fixes:**

- `useCaptchaToken.getToken()` now **awaits the full browser-fallback round trip** (Custom Tab /
  auth session + deep-link return) instead of returning early, resolving with the real token once
  the app regains focus. No screen-level changes were needed for this — `login.tsx` / `join.tsx` /
  `GuestUpgradeSheet.tsx` already do `await captcha.getToken(); if (!captchaToken) return; ...` in
  their handlers, so the existing code just continues straight into `handleGoogleSignIn(...)` etc.
  the moment the token arrives. This works because Expo Router reuses the screen instance that
  started the fallback (`captcha-callback.tsx`'s `router.back()`), so the async handler awaiting
  `getToken()` is still alive when it resolves. `getToken()` also now recovers a token left behind
  by a fallback that resolved with nobody awaiting it (e.g. the OS killed the app while the tab was
  open and the deep link cold-started a fresh instance).
- Removed the `FALLBACK_COOLDOWN_MS` / `isCoolingDown()` / `lastFallbackAt` mechanism entirely
  from `captchaFallbackStore.ts` and `captchaBrowserFallback.ts`. Concurrency safety is fully
  covered by the pre-existing `status === 'pending'` → `'busy'` guard, which doesn't have the
  false-positive problem a wall-clock cooldown does.
- `captcha-redirect.tsx` gained a 12s watchdog: if neither a token nor an error arrives in time, it
  shows `captchaRedirect.stalled` with a `captchaRedirect.retry` link that remounts the widget for
  a fresh attempt, instead of hanging on `captchaRedirect.verifying` forever. New `en`/`de` keys in
  `auth.json`.

**Not fixed, out of scope for this pass:** *why* the embedded widget or the fallback page's
invisible challenge sometimes doesn't settle within its window at all (network conditions, a
particular device's WebView, or a genuine Cloudflare-side hiccup weren't distinguished) — the fix
here is making that failure mode recoverable and non-sticky, not eliminating it.

**Verified:** `npm run typecheck` exits 0, `npm test` passes (227 tests). Not yet re-verified on
the physical Android device that surfaced these bugs — that's the next step before considering
this closed.

---

## 2026-08-09 — Turnstile widget mode `managed` → `invisible` (Dashboard/API only, no migration)

**Why:** Tech Lead reported the Android sign-in funnel was broken by CAPTCHA latency: the
embedded native Turnstile widget (added 2026-08-04, see below) took up to ~10s, then handed off
to a Chrome Custom Tab on `web.vacationist.app` for several more seconds, before the Google
Sign-In button or magic-link field became usable. New users were closing the app immediately
after install rather than waiting through it.

**Two verified root causes**, not both fixed the same way:

1. `TurnstileWidget.tsx` loaded the challenge via `source={{ html: HTML, baseUrl:
   'https://web.vacationist.app' }}` — on Android that's `loadDataWithBaseURL`, which does not
   give the document a normal security origin. Turnstile has no official WebView support, and
   this exact pattern is widely reported (Cloudflare community threads, GitHub issues) to break
   its cookie handling and cross-origin frame access. **Fixed in code**: the challenge now loads
   by URI from a real hosted page, `apps/mobile/public/captcha-embed.html`
   (`https://web.vacationist.app/captcha-embed.html`), which Vercel serves as a static file ahead
   of the SPA rewrite — same mechanism already proven by `apps/mobile/public/robots.txt`.
2. The widget (sitekey `0x4AAAAAADmlpH4qVMwb-i5j`) was in `managed` mode, confirmed via
   `GET /accounts/{account_id}/challenges/widgets` — meaning it could escalate to a checkbox the
   user must click, and the widget is reported non-interactive on some Android devices, so the
   challenge could hang indefinitely (the old 15s watchdog covered exactly this). **Fixed via the
   Cloudflare API**: `PUT /accounts/{account_id}/challenges/widgets/0x4AAAAAADmlpH4qVMwb-i5j`
   with `mode: "invisible"`. This is a single shared widget/secret — Supabase Auth's CAPTCHA
   config only supports one Turnstile secret per project, so the mode change applies to web too.
   Sanity-checked immediately after (production `web.vacationist.app/login`): Google button, email
   field, and submit button all interactive within ~4s of page load, no visible widget, no console
   errors.

Invisible mode requires referencing Cloudflare's [Turnstile Privacy
Addendum](https://www.cloudflare.com/turnstile-privacy-policy/) in the privacy policy — updated
both `docs/privacy-policy.html` and `marketing/site/content/de/legal/privacy-policy.md`.

**Code changes alongside:**
- `login.tsx`, `join.tsx`, `GuestUpgradeSheet.tsx` no longer gate the Google/magic-link controls
  behind `captchaReady` — they render immediately and interactively; the embedded (now invisible)
  widget resolves in the background. On submit, `useCaptchaToken`'s `getToken()` returns
  immediately if a token is already there, otherwise waits up to 5s before deferring to the
  browser fallback — which is now **only** triggered from a submit handler on a definite widget
  failure or that 5s timeout, never automatically on a mount-time watchdog. The user taps once
  more if a fallback was needed; no auto-resume across the app background/foreground cycle.
- `TurnstileWidget.tsx` (native) simplified accordingly: no more watchdog/retry/attempt loop or
  fallback-store reconciliation — that orchestration moved to the new
  `features/auth/hooks/useCaptchaToken.ts`, shared across all three screens above.
- `GuestUpgradeSheet`'s magic-link path no longer calls `getToken()` at all — it never forwarded
  a captcha token to `linkGuestWithMagicLink` in the first place (`PUT /user` has no captcha
  support in auth-js), so waiting on it there only risked an unnecessary browser hand-off for zero
  server-side benefit.

**Server-side enforcement is unchanged** — Auth → Attack Protection stays **ON** on dev and prod
(see the 2026-08-04 entry below); this was a client-side latency/UX fix, not a decision to weaken
verification.

**Not yet device-verified this session** — the fix needs a preview APK on a physical Android
device to confirm the actual before/after timing improvement; verified so far only against
production web and a code review of the message-passing contract between
`captcha-embed.html` ↔ `TurnstileWidget.tsx` ↔ `useCaptchaToken.ts`.

App version bumped `1.29.0` → `1.29.1` (PATCH — bug fix, no native/plugin changes, OTA-eligible).

---

## 2026-08-09 — `attribution-capi` migrated to Reddit CAPI v3; fires on every sign-up (code-only, no migration)

**Why:** Tech Lead reported the Reddit Conversions API access token showed as never accessed,
and no `SIGN_UP` events appeared under the CAPI source in Reddit Ads Manager's Events overview.

Two independent, compounding bugs, both from the original Phase 14 build:

1. **The Reddit call was unreachable.** `attribution-capi` returned `204` early whenever
   `rdt_cid` was absent. Querying `analytics_events` in both dev and prod showed **every**
   `sign_up` row ever recorded had `rdt_cid = NULL` — no real Reddit ad click had reached a
   sign-up yet, so the `fetch()` to Reddit had never once executed. This is why the token was
   untouched: not an auth bug, a reachability bug.
2. **The payload would have been rejected anyway.** The original entry below states "Reddit
   does not publish a public interactive API reference." **That claim was wrong** — it exists
   at `https://ads-api.reddit.com/docs/v3/` (blocked to this session's `WebFetch` tool, but
   readable via the Chrome browser tool; if a future session hits the same WebFetch block,
   that's the workaround). Reading the official reference confirmed the Phase 14 request was
   neither valid v2 nor valid v3: it POSTed a v2 body shape, with a v3-era field name
   (`event_at`), in v2's format (ISO 8601 string), to the deprecated v2 endpoint.

**Full v2 → v3 delta** (per `https://ads-api.reddit.com/docs/v3/guides/programs/capi/migration`
and `https://ads-api.reddit.com/docs/v3/api/post-conversion-events`):

| Field | v2 (old code) | v3 (current code) |
|---|---|---|
| Endpoint | `/api/v2.0/conversions/events/{id}` | `/api/v3/pixels/{pixel_id}/conversion_events` |
| Body root | `{ test_mode, events }` | `{ data: { events } }` |
| Timestamp | `event_at` ISO 8601 string | `event_at` int64 Unix epoch **milliseconds** |
| Event type | `event_type: { tracking_type: 'SignUp' }` | `type: { tracking_type: 'SIGN_UP' }` |
| Dedup key | `conversion_id` at event root | `metadata.conversion_id` |
| Source channel | *(absent)* | `action_source` — **required**: `WEBSITE` \| `APP` |
| Test mode | `test_mode: false` | *(removed)*; optional `data.test_id` for Events Testing only |

Also confirmed, so recorded here rather than left as an open question for the next session:
- The `REDDIT_AD_ACCOUNT_ID` secret's value (`a2_jcz7aqtl8eua`) is actually the **Pixel ID** (same
  value `apps/mobile/src/utils/webPixel.ts`'s `REDDIT_PIXEL_ID` uses for the client pixel) — the
  secret *name* is misleading but the *value* is correct for the v3 URL path. Left un-renamed
  (aliased to `REDDIT_PIXEL_ID` in code instead) to avoid touching the prod secret for no
  functional gain.
- The existing conversion access token is valid for v3 — Reddit's migration guide states no new
  token is required.

**Scope change (Tech Lead decision):** the `if (!rdtCid) return 204` early return is removed.
Reddit is now called for **every** sign-up, not only ones with a click ID — Reddit's own docs
recommend sending all conversions for volume/optimization signal, and this makes the integration
observable in Events Manager immediately rather than waiting on a real ad click. `click_id` is
attached only when `rdt_cid` is present; **no `user` match-key object is sent** (no `external_id`,
no hashed email) — this stays click_id-only by design, so no new personal data leaves the system
beyond what Phase 14 already sent.

**Also fixed:** a successful Reddit response is now logged (`console.log`, not just
`console.error` on failure) — previously a successful run was silent by design, which is part of
why this integration's total non-functionality went unnoticed since Phase 14.

**Verified this session:** deployed to dev, triggered a real sign-up against dev, confirmed the
row landed in `analytics_events` (no regression from removing the early return), and confirmed
with the Tech Lead directly in Reddit Ads Manager's Events Manager that the `SIGN_UP` event now
appears under the CAPI source. Deployed to prod immediately after (non-destructive, code-only).

**Not done:** an optional `REDDIT_CAPI_TEST_ID` env var was added (tags events with a `test_id`
so Events Testing verification doesn't pollute real ad metrics) but was never set on either
environment for this verification — the dev sign-up above posted as a real, non-test conversion
event. Set it as a dev-only secret before the next manual Events Testing pass, and remember to
unset it again afterward; it must never be set on prod.

**Non-destructive** (no schema change, code-only). Applied to: dev, then prod (2026-08-09).

---

## 2026-08-08 — Two bugs found while chasing "attribution-capi never succeeds on dev"

Both pre-existing/newly-introduced-this-phase, neither related to the CAPI auth fix below —
found while trying to reproduce a real signed-in call and reading actual Edge Function/Postgres
logs together with the Tech Lead rather than guessing further.

### Bug 1 (real, pre-existing, unrelated to Phase 14): `create-example-trip` duplicate trip_members insert

**Not actually the reason attribution-capi never fired** (see Bug 2), but found in the logs
while investigating and worth fixing regardless per the "always fix pre-existing issues you
find" rule.

`public.trips` has an `AFTER INSERT FOR EACH ROW` trigger (`on_trip_created` →
`public.handle_new_trip()`, `20260511000002_create_trips_members_invites.sql`) that already
inserts `trip_members(NEW.id, NEW.created_by, 'organizer')` for **every** trip, from **any**
caller — `packages/api/src/trips.ts`'s real in-app `createTrip()` relies on exactly this and
never touches `trip_members` itself. `supabase/functions/create-example-trip/index.ts`'s old
step 2 explicitly inserted the identical `(trip_id, user_id, 'organizer')` row a second time,
colliding with `trip_members_trip_id_user_id_key` on **every single invocation** — not a race,
reproduces every time. `logIfError` swallowed it (best-effort seeding, by design), so it never
broke signup, but it logged a real `23505` error on every fresh non-guest sign-up since this
function existed.

**Fix:** deleted the redundant explicit insert; the trigger already covers it. Redeployed
`create-example-trip` (with `--no-verify-jwt`, matching how it's always been deployed — no
`supabase/config.toml` entry for it) to dev, then prod.

**Non-destructive** (Edge Function code only, no schema/data change). Applied to: dev, then
prod (2026-08-08).

### Bug 2 (introduced this phase, the actual reason attribution-capi never fired): module-level tracking guard wasn't scoped to a user

`maybeTrackSignUp()`'s dedup guard (`apps/mobile/src/features/consent/utils/trackSignUp.ts`)
was a bare module-level `let signUpTracked = false`, intended only to stop
`useAuthInit.ts`'s `loadSession()` and its `onAuthStateChange` listener from double-firing for
*the same* fresh sign-in race. In practice it silently blocked **every subsequent distinct
sign-up in the same app session** too: delete an account and sign up again without reloading
the app (exactly the Tech Lead's test), and the second, genuinely new account's `maybeTrackSignUp`
call returns at the very first guard check — no network call is ever attempted, which is why
dev's Edge Function logs showed no request at all (not even a 401) for that second sign-up.

**Fix:** guard now keyed by `profile.id` (`let trackedUserId: string | null = null`) instead of
a plain boolean — dedupes the same account's own race exactly as before, but a later, distinct
account's sign-up still tracks correctly.

**Client-side only, no deploy needed** beyond the app itself picking up the new build.

---

## 2026-08-08 — Phase 14: attribution-capi always returned 401 on dev (no migration)

**Why:** Tech Lead reported `attribution-capi` had never been successfully called on dev —
every invocation returned 401, including from real signed-in sessions in the app, not just
unauthenticated test calls.

**Root cause:** `reportSignUpAttribution()` called `supabase.functions.invoke()` and relied on
`@supabase/supabase-js`'s internal `fetchWithAuth` wrapper to *implicitly* inject the current
session's access token as the Authorization header. That mechanism re-reads
`auth.getSession()` at fetch time via a fresh `FunctionsClient` created on every access to the
`.functions` getter — undocumented-enough behavior, and timing-sensitive enough right after a
sign-in event resolves, that it could not be trusted to reliably carry the live session into
the request. (Traced through the actual installed `@supabase/supabase-js` and
`@supabase/functions-js` source — `SupabaseClient.ts`, `functions-js/FunctionsClient.ts`,
`supabase-js/lib/fetch.ts` — rather than guessed from library docs, which describe the
intended behavior but not this edge case.)

**Fix:**
1. `reportSignUpAttribution()` now calls `supabase.auth.getSession()` itself and attaches
   `Authorization: Bearer <access_token>` explicitly on the `functions.invoke()` call, instead
   of relying on implicit injection. Matches this repo's existing Auth Pattern rule (read
   `getSession()` directly rather than depend on implicit client behavior).
2. `attribution-capi` now logs *why* a 401 happened (missing/malformed header vs. what
   `auth.getUser()` rejected it for — never the token itself) — previously both paths returned
   a bare 401 with zero server-side signal, which is exactly what made this bug invisible.

**Not fully re-verified this session** — same CAPTCHA wall on both dev and prod blocks
generating a real test JWT from this environment; the fix is grounded in a full trace of the
actual client-library code path (not a guess) and in the explicit-token pattern already proven
to work in `useAuthInit.ts`'s `getSession()` usage elsewhere in the app, but the *authenticated
happy path against attribution-capi specifically* still needs the deferred next-release
verification already noted in the 2026-08-08 entries below.

**Non-destructive.** Applied to: dev, then prod (2026-08-08).

---

## 2026-08-08 — Phase 14: attribution-capi — pixel/CAPI deduplication + web CAPI (no migration)

**Why:** Walking through Reddit Ads Manager's "Get started" checklist surfaced two real gaps
in the initial `attribution-capi` build:

1. **No deduplication.** Reddit dedupes a client-pixel event and a server (CAPI) event for the
   same real-world conversion only when they share a `conversionId`/`conversion_id` and event
   name. Neither channel had ever generated or passed one.
2. **Web signups never got a CAPI report at all** — only the client pixel. Standard practice
   (and what Reddit's own wizard nudges toward) is both channels for the same event: the pixel
   alone isn't resilient to ad blockers, and CAPI alone can't see traffic the same way a
   browser can. Native was always CAPI-only by necessity (no pixel is possible there).

**Changes:**
1. **`attribution-capi` now accepts `surface` (`web_app` | `native_app`, was hardcoded
   `'native_app'`) and a required `conversion_id`** (client-generated via
   `expo-crypto`'s `randomUUID()` — confirmed to have a real web implementation, not
   native-only, before relying on it). Forwarded to Reddit as `conversion_id` on the CAPI
   event; on web, the same value is also passed to the client pixel call
   (`window.rdt('track', 'SignUp', { conversionId })`) so Reddit can match the two into one
   conversion. `packages/api/src/analytics.ts`'s `reportNativeSignUp` renamed
   `reportSignUpAttribution` to reflect it's no longer native-only.
2. **Web-side attribution capture added** — `web.vacationist.app` is a different origin from
   `vacationist.app`, so `rdt_cid` never crossed that boundary before. `marketing/site/track.js`
   gained `rewriteWebAppLinks()` (plain query params, unlike the Play Store link's
   Android-specific `referrer=` encoding) and the app gained
   `apps/mobile/src/features/consent/utils/webAttribution.ts`, which captures the landing query
   string **at module load** (before `AuthGate`'s redirect effect can strip it from the URL on
   an unauthenticated visit) and holds it in memory only — never written to durable storage
   until consent is granted, matching the existing "log nothing without consent" rule.
3. Endpoint/body shape for `conversion_id` cross-referenced the same way as the rest of the
   CAPI payload (no official Reddit reference is public) — same caveat as `event_at` in the
   original entry below: verify in Reddit Events Manager's "Test Events" tool after the next
   real release.

**Verified this session:** auth rejection (`401` for missing/invalid session) unchanged on both
dev and prod after the contract change. **Not verifiable this session** — same CAPTCHA wall as
the original `attribution-capi` entry below; the authenticated happy path (including whether
Reddit actually dedupes the pixel+CAPI pair) is deferred to the next real release.

**Non-destructive** (no schema change). Applied to: dev, then prod (2026-08-08).

---

## 2026-08-08 — Phase 14: analytics_events retention cron

### Migration: `20260808110000_create_analytics_events_retention_cron.sql`

**Why:** `analytics_events` (created earlier this phase) had no stated retention limit —
GDPR's storage-limitation principle expects one, and the migration that created the table
explicitly left this open for a Tech Lead decision. Decided: **14 months**, matching common
ad-industry / GA4-style retention. `docs/privacy-policy.html` and the German legal source
state this same figure — if this value ever changes, both need updating together.

**Changes:**
1. **`private.prune_analytics_events()`** — `DELETE ... WHERE created_at < NOW() - INTERVAL
   '14 months'`, mirrors the `private.create_activity_reminders()` cron pattern
   (`20260708100000`).
2. **pg_cron job `prune-analytics-events`** — daily at `03:00 UTC`, unschedule-then-schedule
   idiom for idempotency.

**Non-destructive** (deletes only rows already past the stated retention window; none exist
yet). Applied to: dev, then prod (2026-08-08).

---

## 2026-08-08 — Phase 14: attribution-capi Edge Function (no migration)

**Why:** Real sign-up happens inside the native Expo app — there is no client-side pixel that
can see it. `attribution-capi` is the server-to-server counterpart to the web `SignUp` pixel
event added earlier this phase: it reports a genuine new sign-up (or guest→full-account
upgrade) to Reddit's Conversions API when the install carried a `rdt_cid` captured from the
Play Store install referrer (see `apps/mobile/src/features/attribution/utils/installReferrer.ts`
and `marketing/site/track.js`'s Play Store link rewrite).

**New Edge Function `attribution-capi`:** unlike `track-event`, this one requires a real
authenticated caller — `verify_jwt` is left at the platform default (`true`, no
`supabase/config.toml` override), and the function additionally re-derives the caller's
identity via `auth.getUser(jwt)` rather than trusting the platform gate alone (an anon/
publishable-key-only request also satisfies `verify_jwt=true` but is not a real user session).
Always logs to `analytics_events` (`surface: 'native_app'`); only calls Reddit's CAPI when
`rdt_cid` is present — an organic native install has nothing for Reddit to attribute, and per
the no-raw-IP decision there is no IP+user-agent fallback signal to send instead. A Reddit-side
failure is logged and swallowed, never surfaced to the caller — sign-up itself has already
succeeded by the time this function is called.

**New secrets** (dev + prod): `REDDIT_AD_ACCOUNT_ID` (`a2_jcz7aqtl8eua` — confirmed by the Tech
Lead to be identical to the Pixel ID for this account), `REDDIT_CAPI_ACCESS_TOKEN` (non-expiring
Conversions API access token from Reddit Ads Manager).

**CAPI request shape not independently confirmed against an official Reddit reference** — Reddit
does not publish a public interactive API reference; the endpoint
(`https://ads-api.reddit.com/api/v2.0/conversions/events/{account_id}`) and body shape
(`{ test_mode, events: [{ event_at, event_type: { tracking_type }, click_id }] }`) were
cross-referenced across multiple third-party CAPI integration docs (PostHog, CommandersAct,
Segment) that converged on the same shape. `event_at` as ISO 8601 is a guess (not confirmed) —
first thing to check in Reddit Events Manager's "Test Events" tool after the next real release
if events show as rejected.

**Verified this session (curl):** unauthenticated request (no/garbage/anon-key-only
Authorization header) → `401` on both dev and prod. **Not verifiable this session:** the
authenticated happy path — dev has Turnstile CAPTCHA protection on sign-in/anonymous-sign-in
(enabled 2026-08-04), and prod does too as of this deploy, so no valid user JWT could be
obtained without completing a CAPTCHA, which is out of scope regardless of testing intent.
Full end-to-end verification (install from Play Store internal testing → sign up → confirm in
Reddit Events Manager + a `analytics_events` row) is deferred to the next real release, per
Tech Lead decision.

**Non-destructive** (no schema change — writes to the existing `analytics_events` table from
the migration above). Applied to: dev, then prod (2026-08-08).

---

## 2026-08-08 — Phase 14: analytics_events table + track-event Edge Function

### Migration: `20260808100000_create_analytics_events.sql`

**Why:** Reddit Ads is now running and needs conversion signal fed back to it, and the Tech
Lead wants a first-party view of the whole customer journey (paid Reddit + organic) that
survives ad blockers and doesn't depend on Reddit's own reporting. This is the data layer for
that — a local funnel event log, populated by the new `track-event` Edge Function and read by
a local-only dashboard script (`scripts/analytics-report.mjs`, not yet built).

**Changes:**
1. **New table `public.analytics_events`** — append-only funnel log: `event_name` (CHECK
   allowlist: `page_visit`, `play_store_click`, `web_app_click`, `app_store_interest`,
   `sign_up`), `surface` (`marketing` / `web_app` / `native_app`), `path`, `rdt_cid`, four
   `utm_*` columns, `referrer_host`, `user_agent`, `visitor_hash`, `user_id` (nullable FK).
   **Deliberately has no raw-IP column** — see `engineering/software_engineering_guide.md`
   Section 14 for the project's PII-minimization stance; `visitor_hash` is a same-day rotating
   salted hash computed inside the Edge Function (IP used only as ephemeral hash input inside
   `track-event`, never persisted).
2. **`user_id` uses `ON DELETE SET NULL`**, not a bare non-cascading FK — chosen specifically
   so `delete_own_account()` needs no companion change, unlike the `trip_messages` gap fixed
   2026-07-27 (see that entry below). Verified against `pg_constraint` after applying: the FK
   already shows `confdeltype = 'n'` (SET NULL) on both dev and prod, so no reassignment line
   is needed in `delete_own_account()`.
3. **RLS**: enabled, with explicit deny-all INSERT/UPDATE/DELETE policies for `anon` and
   `authenticated` (mirroring the `trip_messages` deny-write pattern). **No SELECT policy
   exists for either role at all** — reads are `service_role`-only by omission, exercised only
   by the local dashboard script via the service-role key, never by a client.

### Edge Function: `track-event`

The repo's **first browser-facing** Edge Function — `push-notification` and
`create-example-trip` are both server-to-server (`pg_net` / DB trigger), with zero CORS
handling. This one is called directly from anonymous marketing-site visitors and the web app,
so it adds an `OPTIONS` preflight branch and an origin allowlist
(`vacationist.app`, `web.vacationist.app`, plus three localhost dev ports) that those two
never needed. Validates `event_name`/`surface` against the same allowlist as the table's CHECK
constraints, caps payload size at 4KB, drops any field not on the known list, and rejects the
whole request if any string field looks IP-shaped (defense in depth on top of the schema
already having no IP column). `verify_jwt = false` in `supabase/config.toml`, same as
`push-notification`.

New secret **`ANALYTICS_VISITOR_HASH_SALT`** — set independently on dev and prod (not shared),
used only as hash input for the daily-rotating `visitor_hash`; never logged, never exposed to
clients.

**Verified on both dev and prod** (curl): valid payload → `204`; unknown `event_name` → `400`;
disallowed `Origin` → `403`; IP-shaped field value → `400`; `OPTIONS` preflight → `204`; direct
anon `SELECT` → empty result set; direct anon `INSERT` → RLS `42501` violation, `401`.

**Non-destructive.** Applied to: dev, then prod (2026-08-08).

---

## 2026-08-04 — Wire up Turnstile CAPTCHA verification (dashboard config, no migration)

**Why:** The Turnstile widget (`0x4AAAAAADmlpH4qVMwb-i5j`) has rendered on login, guest join, and
guest upgrade since `e197589` (2026), and the client has always passed the resulting token into
supabase-js as `options.captchaToken`. Nothing was ever verifying it: Auth → Attack Protection was
never enabled on either project, so GoTrue received every token in `gotrue_meta_security` and
silently discarded it. The widget provided zero actual bot protection. There is no custom backend
in this request path — GoTrue itself performs the canonical
`POST challenges.cloudflare.com/turnstile/v0/siteverify` once CAPTCHA protection is enabled with
the widget's secret, so enabling it *is* the fix. No Edge Function, no new infrastructure.

**Config change (Dashboard only, not a migration):**
Auth → Attack Protection → CAPTCHA protection → provider **Turnstile** → secret pasted directly
from the Cloudflare dashboard. The secret was never entered into this repo, this chat, or any env
file that ships — `supabase/config.toml` carries a commented `[auth.captcha]` block for
documentation only, since `supabase config push` is never run against this project (it would
clobber the remote `site_url` with the local `http://localhost:8081` value).

- **Enabled: dev (`aejywkbkcwyanhyzhrle`).**
- **Not yet enabled: prod (`fsfsqghbejwvgxujoyne`)** — pending a device-tested build with the code
  fixes below (magic link, guest join, and Google Sign-In all re-verified against dev first, since
  the switch rejects any request without a valid token the instant it's flipped).

**Code fixes made alongside (all pre-existing bugs, invisible until the switch above is live):**
1. **Token reuse.** Turnstile tokens are single-use, but `TurnstileWidget` rendered `null` forever
   after delivering one and callers never requested a fresh challenge after consuming it — a
   second submit on the same screen had no token, and a failed submit retried the same
   already-redeemed token (`timeout-or-duplicate`). Added a `resetNonce` prop; `login.tsx`,
   `join.tsx`, and `GuestUpgradeSheet.tsx` now bump it in a `finally` around every consumption
   attempt, success or failure.
2. **Google Sign-In sent no token.** `signInWithGoogleIdToken` / `linkGuestWithGoogle` never
   forwarded `captchaToken` to `supabase.auth.signInWithIdToken`, even though auth-js supports it
   on that grant. Threaded through `packages/api/src/auth.ts` → `useGoogleSignIn` /
   `useGuestUpgrade` → the login/guest-upgrade screens.
3. **Guest-upgrade token is unverifiable.** `linkGuestWithMagicLink` passed `captchaToken` to
   `supabase.auth.updateUser()`, but `PUT /user` (what `updateUser` calls) has no captcha support
   in auth-js at all — the options type accepts only `emailRedirectTo`. It typechecked only
   because a conditional object spread dodges excess-property checking. **This path cannot be
   server-verified with the current Supabase Auth API.** Removed the dead argument rather than
   pretend it does something; the Turnstile widget stays in `GuestUpgradeSheet` as a UI-consistency
   gate only. This flow requires an existing authenticated (anonymous) session and is already
   rate-limited, so the residual bot-abuse surface is low. Revisit if Supabase ever adds captcha
   support to the user-update endpoint.

**Non-destructive.** Auth config toggle only; no schema, no data change. No new migration file.

---

## 2026-07-27 — Fix delete_own_account(): wrong column name + missing chat reassignment

### Migration: `20260727130000_fix_delete_own_account_joined_at_and_chat`

**Why:** Reported error `42703 column "created_at" does not exist` on account deletion. Two
independent pre-existing bugs in `public.delete_own_account()`, neither introduced this session:

1. **Bug 1 (the reported error).** The last-organizer promotion subquery did
   `ORDER BY created_at ASC` against `public.trip_members`, which has never had a `created_at`
   column — only `joined_at` (`20260511000002_create_trips_members_invites.sql`). Fired whenever
   the deleting user was the sole organizer of a trip that still had other members. Unrelated to
   chat specifically — the correlation with chat users was coincidental (both require a shared
   trip). The RPC is one transaction, so the error rolled back cleanly with no partial state.
2. **Bug 2 (next failure once Bug 1 is fixed).** `trip_messages.created_by` (added
   `20260716100000`, nine days after this RPC was written) has no `ON DELETE` clause and was never
   added to the sentinel-reassignment list. Any user who had sent a chat message would hit a
   foreign-key violation (`23503`) on the final `DELETE FROM auth.users`. Audited every
   `REFERENCES public.users(id)` FK across all migrations — `trip_messages` was the only
   non-CASCADE one missing from the list.

**Changes:**
1. Promotion subquery now orders by `(role = 'guest'), joined_at ASC` — prefers the earliest-joined
   **participant**, falling back to a guest only if no participant remains (Tech Lead decision:
   guests are restricted from managing trips everywhere else in the app).
2. `UPDATE public.trip_messages SET created_by = v_sentinel WHERE created_by = v_caller` added
   alongside `trip_notes` / `activity_notes` / `accommodation_notes`. Chat messages survive account
   deletion, attributed to "Deleted User" with text intact (Tech Lead decision: consistent with how
   every other authored content is already handled, not soft-deleted).

Everything else — guest guard, `session_replication_role` replica/origin window, explicit
`trip_members` delete before the reset — carried over verbatim from `20260707110000`.

**New rule added to CLAUDE.md:** when a new table gets a non-CASCADE FK to `public.users`, add it
to `delete_own_account()`'s reassignment list in the same migration — this is the exact gap that
caused Bug 2.

**Non-destructive** (`CREATE OR REPLACE FUNCTION`, no schema change). Applied to: dev, then prod.

---

> **Schema dumps without Docker (this machine has no Docker):** `supabase db dump` always shells into a Docker `pg_dump` and fails here — but `npx supabase db dump --linked --dry-run` needs no Docker and prints the complete dump script, **including ephemeral login-role credentials** (`PGHOST`/`PGUSER`/`PGPASSWORD` for a temporary `cli_login_postgres.<ref>` role) plus the exact pg_dump flags and sed filters the CLI would run. Replay it with the locally installed PostgreSQL 17 client (`C:\Program Files\PostgreSQL\17\bin\pg_dump.exe`, matches both projects' Postgres 17.6): set the printed `PG*` env vars, then run `pg_dump --schema-only --quote-all-identifiers --role postgres --exclude-schema "<list from the script>"` (note: the local binary wants `--quote-all-identifiers`, plural — the script prints the singular form). For dev↔prod diffs, strip `^\\(un)?restrict` lines (random per dump) and `^--` comments from both outputs before diffing. Quick alternative without dumps: compare `supabase migration list` ledgers on both projects.

## 2026-07-27 — Security review fixes: chat plaintext leak, trip_messages RLS gap, real AES-256

A focused security review of the travel-document and chat-message encryption (`/security-review`,
2026-07-27) found three gaps, all fixed in this session. See `engineering/software_engineering_guide.md`
Section 14 for the updated encryption rule.

### Migration: `20260727100000_chat_notification_no_plaintext`

**Why:** `notify_on_new_chat_message()` was decrypting every new chat message and storing the first 200
chars in `notifications.context_entity` (plain TEXT, no retention job, broadcast via Realtime with
`REPLICA IDENTITY FULL`) — completely defeating the AES encryption added to `trip_messages.text` in
`20260719100000_encrypt_trip_messages`.

**Changes:**
1. `notify_on_new_chat_message()` recreated — passes `NULL` for `p_context_entity`; `context_trip` /
   `context_creator` (trip title, sender name — not sensitive) are unchanged.
2. Backfill: `UPDATE notifications SET context_entity = NULL WHERE type = 'new_chat_message'` — purges
   plaintext already written to existing rows.
3. New RPC `get_chat_push_preview(p_message_id)` — decrypts a 200-char preview on demand, at push-send
   time only. No `auth.uid()` check (there is no caller session); locked down instead via
   `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` / `GRANT ... TO service_role`. Returns `NULL`
   if the message is missing or soft-deleted before delivery.

**Client changes (same session):**
- `supabase/functions/push-notification/index.ts` — new `resolveChatPreview()` calls the RPC once per
  invocation (per-recipient in `handleSingle`, once per batch in `handleBatch`, after the preference
  filter) and injects the result as `context.entity`. New `new_chat_message_generic` template (no
  `{{entity}}`) used when the preview comes back null.
- `apps/mobile/src/features/notifications/components/NotificationItem.tsx` — `new_chat_message` body
  template changed to a generic `'{{creator}} sent a message.'`. **Deliberately diverges** from the
  edge function's template now (that one still interpolates a decrypted preview for the push only) —
  both files' "keep in sync" comments updated to say so.

**Applied to:** dev (push before testing), prod (after dev verification).

---

### Migration: `20260727110000_lock_down_trip_messages_rls`

**Why:** `trip_messages_insert_member` / `trip_messages_update_owner` (from `20260716100000`) still let
any authenticated trip member write directly via PostgREST/supabase-js, bypassing
`create_trip_message` / `update_trip_message` entirely — RLS, not "the app only calls the RPC", is the
actual trust boundary. A trip member could insert/update the BYTEA `text` column with raw un-encrypted
bytes, and any other member's direct `SELECT` would read it back as plaintext with no key needed. This
is the same class of gap `user_travel_documents` was already locked down against
(`20260525000002`) — chat never got the equivalent policy.

**Changes:**
1. Dropped `trip_messages_insert_member` / `trip_messages_update_owner`; replaced with
   `trip_messages_no_direct_insert` / `trip_messages_no_direct_update` (`WITH CHECK (false)`), mirroring
   `user_travel_documents`. `trip_messages_select_member` (Realtime dependency) untouched.
2. New RPC `seed_trip_message(p_trip_id, p_user_id, p_text)` — service-role-only (same REVOKE/GRANT
   pattern as above), for `create-example-trip`. `create_trip_message` reads `auth.uid()`, which is
   `NULL` under the service_role key that function uses, so it couldn't be reused directly.

**Verified safe:** `packages/api/src/messages.ts` has zero direct `.from('trip_messages')` writes; all
three chat mutations (`create`/`update`/`deleteTripMessage`) already route through the SECURITY DEFINER
RPCs via `mutationDefaults.ts`, which are unaffected by RLS.

**Applied to:** dev, then prod.

---

### `create-example-trip` fix (same session, no migration)

**Why:** `supabase/functions/create-example-trip/index.ts` still did a direct
`.from('trip_messages').insert([...])` with a plaintext string. Since `trip_messages.text` became BYTEA
in `20260719100000`, the `AFTER INSERT` decrypt trigger aborted every one of these inserts with `Wrong
key or corrupt data` — and because the call never destructured `{ error }`, the failure was swallowed:
the function still returned `200 { trip_id }`. **New users have been getting example trips with zero
chat messages, silently, since the encryption migration shipped.**

**Fix:** replaced the direct insert with two `supabase.rpc('seed_trip_message', ...)` calls, with
`error` checked and logged (non-fatal — this function seeds best-effort). While in the file, added the
same `error`-check-and-log pattern to every other previously-unchecked insert (trip_members, activities,
accommodations, transfer_flights/vehicles/rentals, shopping, recipes, expenses/splits, packing items,
lost & found, trip notes) so a future regression is visible in Edge Function logs instead of invisible.
None of those were failing today — only `trip_messages` was — but there was no way to know that before
this pass, since nothing was logged.

**Redeployed to:** dev, then prod.

---

### Migration: `20260727120000_encrypt_aes256`

**Why:** Every `pgp_sym_encrypt()` call (travel documents and chat messages) was made with no `options`
argument. pgcrypto defaults `cipher-algo` to `aes128` when none is supplied — every comment, prior
migration note, and `engineering/software_engineering_guide.md` claimed "AES-256 column encryption",
but the actual cipher in use had been AES-128 since inception. Not a break (AES-128 remains sound), but
a documented-vs-actual mismatch worth closing given the explicit compliance-style claim.

**Changes:**
1. Recreated `upsert_travel_document`, `create_trip_message`, `update_trip_message`,
   `seed_trip_message` with `'cipher-algo=aes256'` as the third `pgp_sym_encrypt()` argument. No
   `pgp_sym_decrypt()` changes needed — it reads the algorithm from the PGP packet header, so AES-128
   and AES-256 rows decrypt identically; safe to apply live, no coordinated deploy needed.
2. Re-encrypted all existing rows in `user_travel_documents` (`full_legal_name`, `document_number`,
   `date_of_birth`, `notes`) and `trip_messages` (`text`) — decrypt with the old default, re-encrypt
   with `cipher-algo=aes256` — so the AES-256 claim is retroactively true, not just for new rows.
   `user_travel_documents_updated_at` / `trip_messages_updated_at` triggers disabled for the backfill
   `UPDATE`s so the re-encryption doesn't appear as a user edit (`on_trip_message_update_restrict` left
   enabled — it only guards `trip_id`/`created_by`/`created_at`, none of which this touches).

**Non-destructive.** Applied to: dev, then prod.

---

### Types

`packages/api/src/database.types.ts` — added `seed_trip_message` and `get_chat_push_preview` to the
`Functions` block for schema-truth parity (hand-edited; no Docker on this machine, per the header
note above). Neither is called from `packages/api` — both are service-role-only and used exclusively
by their respective Edge Functions — so this doesn't change any typed client call site.

Deliberately did **not** special-case `trip_messages`' `Insert`/`Update` `text` typing away from plain
`string`: `user_travel_documents`'s BYTEA columns (already RLS-locked the same way) keep the same plain
`string` shape, and a hand-divergence here would silently revert on the next `supabase gen types` run
while giving false confidence — RLS (Fix 2 above) is the actual enforcement, not the generated type.

---

## 2026-07-19 — Fix ambiguous id in create_trip_message

### Migration: `20260719120000_fix_ambiguous_id_in_create_trip_message`

**Why:** After fixing the `trip_id` ambiguity, `create_trip_message` hit a second `42702` error: `RETURNING id INTO v_id` — bare `id` is ambiguous between the `RETURNS TABLE` output variable and `trip_messages.id`.

**Fix:** `CREATE OR REPLACE FUNCTION` for `create_trip_message`. Added `AS ins` alias to the INSERT target and changed `RETURNING id` → `RETURNING ins.id`. All other column references in the function are already table-alias qualified.

**Applied to:** dev + prod.

---

## 2026-07-19 — Fix ambiguous trip_id in chat RPCs

### Migration: `20260719110000_fix_ambiguous_trip_id_in_chat_rpcs`

**Why:** `create_trip_message`, `get_trip_messages`, and `get_trip_message_by_id` all declared `trip_id UUID` in their `RETURNS TABLE` signature. Bare `trip_id` in the `WHERE trip_id = …` membership check was ambiguous between the output column variable and `public.trip_members.trip_id`, causing a runtime `42702` error on every call.

**Fix:** `CREATE OR REPLACE FUNCTION` for all three. Added alias `tm` on `public.trip_members` and qualified the column as `tm.trip_id` in every membership check. No schema changes — functions only.

**Applied to:** dev + prod.

---

## 2026-07-19 — Chat message encryption at rest

### Migration: `20260719100000_encrypt_trip_messages`

**Why:** Trip chat messages were stored as plain text in the `trip_messages.text` column. This migration encrypts them at rest using AES-256 (pgp_sym_encrypt), matching the travel documents encryption pattern.

**Changes:**
1. **Vault secret `trip_messages_encryption_key`** — 256-bit random key stored via `vault.create_secret()`.
2. **`private.get_chat_encryption_key()`** — SECURITY DEFINER helper to fetch the decrypted key from vault (same pattern as `private.get_travel_doc_encryption_key()`).
3. **`trip_messages.text`** — column type changed `TEXT → BYTEA`. Existing rows encrypted in-place with `pgp_sym_encrypt`.
4. **`trip_messages_text_check` constraint** — dropped (BYTEA is incompatible with `char_length`); length validation moved to RPC layer.
5. **New SECURITY DEFINER RPCs (all in `public` schema):**
   - `create_trip_message(p_trip_id, p_text)` — validates, encrypts, inserts, returns decrypted row + sender JSON.
   - `update_trip_message(p_message_id, p_text)` — validates, encrypts, updates, returns decrypted row.
   - `get_trip_messages(p_trip_id, p_cursor, p_limit)` — decrypts on read, keyset pagination, returns rows with sender.
   - `get_trip_message_by_id(p_message_id)` — decrypts a single message; used by realtime handler to hydrate the cache after INSERT/UPDATE (realtime payload contains encrypted BYTEA).
6. **`notify_on_new_chat_message()` trigger** — recreated to decrypt `NEW.text` before passing the preview to `private.create_trip_notification()`.

**Client changes (same session):**
- `packages/api/src/messages.ts` — all read/write now goes through the 4 new RPCs; `getMessageById` added for realtime hydration.
- `apps/mobile/src/features/chat/hooks/useTripChatRealtime.ts` — INSERT/UPDATE handlers now call `getMessageById` RPC instead of using the raw (encrypted) payload text.
- `packages/api/src/database.types.ts` — 4 new RPC entries added manually (no Docker for `supabase gen types`).

**Important for next SDK upgrade:** Task 8 (Play Store warning about deprecated edge-to-edge APIs) is caused by React Native / Material internals (`StatusBarModule`, `WindowUtilKt`, `BottomSheetDialog`) still calling deprecated `Window.setStatusBarColor` etc. The app already has `edgeToEdgeEnabled: true`. No app-code fix possible — resolved by upgrading to an Expo SDK version that ships the fixed RN/Material dependencies.

**Applied to:** dev (push before testing), prod (after dev verification).

---

## 2026-07-18 — Chat push notifications

### Migration: `20260718100000_notify_on_new_chat_message`

**Why:** New message INSERTs into `trip_messages` now fan out push notifications to all trip members except the sender. Edits and soft-deletes (UPDATEs) remain silent. Users can opt out per trip via the new "Chat messages" toggle in trip notification settings.

**Changes:**
1. **`notifications_type_check`** — DROP + recreate to include `'new_chat_message'`.
2. **`notification_preferences.new_chat_message`** — `BOOLEAN NOT NULL DEFAULT TRUE` (existing members default to ON).
3. **`notify_on_new_chat_message()` function** (SECURITY DEFINER) — looks up sender name + trip title, then calls `private.create_trip_notification()` with `p_exclude_user_id = NEW.created_by`. `context_entity` holds the first 200 chars of the message text for client-side preview rendering.
4. **`notify_new_chat_message` trigger** — `AFTER INSERT ON public.trip_messages FOR EACH ROW`.

**Non-destructive.** Applied to: dev + prod (2026-07-18).

**Client changes (same session):**
- `NOTIFICATION_TYPE` enum + `NotificationPreference` interface + `updateNotificationPreferencesSchema` updated.
- Push-notification Edge Function: `new_chat_message` translation (title = `{{creator}} in {{trip}}`, body = `{{entity}}`) + preference gate.
- In-app `BODY_TEMPLATES`: `{{creator}}: {{entity}}` (sender name + message preview).
- `resolveNotificationPath`: `new_chat_message` → `/trip/${tripId}?tab=Chat`.
- `NotificationPreferencesSection`: new "Chat messages" toggle row.
- i18n (en/de): `preferences.chatMessages` + `type.new_chat_message`.

---

## 2026-07-13 — Bring rls_auto_enable / ensure_rls under version control (dev↔prod parity)

### Migration: `20260717100000_add_rls_auto_enable_event_trigger`

**Why:** The Docker-free schema dump diff (see header note) surfaced a dev-only `rls_auto_enable()` function + `ensure_rls` event trigger — added once via the SQL editor, never migrated, so prod lacked it. It auto-enables ROW LEVEL SECURITY on any newly created `public` table, a backstop against migrations that forget `ENABLE ROW LEVEL SECURITY`.

**Changes:**
1. `CREATE OR REPLACE FUNCTION public.rls_auto_enable()` (body copied verbatim from dev) + `REVOKE FROM PUBLIC` / `GRANT TO service_role` matching dev's ACL.
2. `DROP EVENT TRIGGER IF EXISTS ensure_rls` + `CREATE EVENT TRIGGER ensure_rls ON ddl_command_end` — idempotent so the same migration converges dev (already had it) and prod (didn't).

Migrations must still write `ENABLE ROW LEVEL SECURITY` explicitly — this is a safety net, not a convention.

**Non-destructive.** Applied to: dev + prod (2026-07-13). Remaining known drift is cosmetic only (variable-name/comment differences in a few older function bodies).

---

## 2026-07-13 — Phase 13: Trip Chat

### Migration: `20260716100000_create_trip_messages`

**Why:** New Trip Chat feature — one lightweight chat per trip (Chat tab between Overview and Prework) so trip-related communication stays inside the trip context.

**Changes:**
1. **`public.trip_messages` table** — `id`, `trip_id` (FK trips, CASCADE), `created_by` (FK users), `text` (≤2000 chars, non-blank CHECK), `created_at`, `updated_at`, `deleted_at` (soft delete). Partial index `(trip_id, created_at DESC) WHERE deleted_at IS NULL` for keyset pagination.
2. **RLS** — SELECT: any trip member (deliberately no `deleted_at IS NULL` filter so the soft-delete UPDATE event passes realtime RLS; clients filter). INSERT: member + own row (guests included). UPDATE: sender only, while not deleted (organizers cannot edit others' messages). No DELETE policy — deletion is RPC-only.
3. **`soft_delete_trip_message(p_message_id)`** SECURITY DEFINER RPC — sender deletes own message (all roles incl. guest), organizer deletes any; sets `deleted_at = NOW()`.
4. **Triggers** — `set_updated_at` on UPDATE; `restrict_trip_message_update_fields` blocks changes to `trip_id`, `created_by`, `created_at`.
5. **Realtime** — `ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_messages`. Soft delete arrives as UPDATE, so no `REPLICA IDENTITY FULL` and no DELETE handler needed; client subscribes with `filter: trip_id=eq.<tripId>` on channel `trip-messages:<tripId>`.

**Non-destructive.** Applied to: dev + prod (2026-07-13). Schema parity verified twice: migration ledgers (`supabase migration list`) identical on both projects, and a Docker-free pg_dump diff (method in the header note) — all `trip_messages` objects identical. The dump diff surfaced only pre-existing drift unrelated to this phase: cosmetic variable-name/comment differences in a few older functions (`check_invite_rate_limit` et al.), and a dev-only `rls_auto_enable()` + `ensure_rls` event trigger (RLS auto-enable safety net) that prod does not have.

**Edge function:** `create-example-trip` redeployed to dev + prod — seeds 2 example chat messages in the demo trip (existing-user guard unaffected).

**Client changes (same PR/session):**
- `packages/api/src/messages.ts` (new): `getTripMessages` (keyset pagination, sender join), `createMessage`, `updateMessage`, `deleteMessage`, `subscribeToMessages`, `unsubscribeFromMessages`.
- `packages/types`: `TripMessage`/`TripMessageWithSender`/`TripMessagesPage`, Zod schemas, mutation Variables.
- `apps/mobile/src/features/chat/` (new): hooks (`useTripMessages` infinite query, mutations with optimistic updates, `useTripChatRealtime`), components (`ChatMessageRow`, `ChatInputBar`, `MessageActionsSheet`), unit-tested cache helpers.
- Chat tab wired into `app/trip/[id]/index.tsx` (between Overview and Prework); mutation defaults + `PERSISTED_MUTATION_KEYS` for offline replay; i18n namespace `chat` (en/de); tutorial slide 1 copy updated + MMKV key bump to `tutorial_seen_v2`.

---

## 2026-07-12 — Retain votes on member removal + membership-filtered vote visibility

### Migration: `20260715100000_retain_votes_on_member_removal`

**Why:** Prod incident — deleting a `trip_members` row (leave/kick/duplicate cleanup) hard-deleted all of the user's votes via `trg_cleanup_votes_on_member_removal`, with no restore on rejoin. Votes are now retained and hidden while the voter is not a member; rejoining with the same user id restores them.

**Changes:**
1. **`cleanup_votes_on_member_removal()` replaced** — no longer deletes votes (function name now historical). Still removes `transfer_vehicle_passengers` + `prework_preferences` and sends the `member_left` notification. **New:** re-evaluates auto-close for the trip's open `auto_close` votings after removal (member-filtered counts; guarded against `member_count = 0`), since removing a non-voter can complete a vote.
2. **SELECT policies replaced ×3** (`activity_votes`, `accommodation_votes`, `transfer_flight_votes`) — a vote is visible only while the **voter** is a current trip member (caller-membership check unchanged; flight policy keeps its parent-EXISTS shape because `transfer_flight_votes.trip_id` is nullable).
3. **All auto-close vote counting member-filtered** — `auto_finalize_activity_voting`, `auto_finalize_accommodation_voting`, `auto_finalize_transfer_flight_voting`, `auto_finalize_flight_voting`, the three `*_on_blocker_removal` functions, and `retroactive_auto_close_activity`: vote and blocker counts now JOIN `trip_members`, so ex-member stale votes/blockers neither complete nor block a vote.
4. **Bug fix:** `restrict_transfer_flight_update_fields()` gains the `pg_trigger_depth() > 1` bypass (activities/accommodations already had it) — previously a non-organizer's final vote on an `auto_close` flight raised `Only organizers can change voting_open`.
5. **Bug fix:** `on_transfer_flight_vote_inserted` trigger re-asserted to execute `auto_finalize_transfer_flight_voting()`, which now (finally) carries the `group_blocker` guard — migration `20260619110000` had added the guard to `auto_finalize_flight_voting()`, a function no trigger executes, so the flight blocker guard was never live.

**Client (same session, OTA-eligible):** `signInAnonymously` now throws `ALREADY_SIGNED_IN` if a session exists; join screen redirects signed-in users to `join-confirm` instead of creating a second anonymous account (session-supersede race); root-layout auth gate preserves the invite token when bouncing an authenticated user off `/join`.

**Non-destructive.** Applied to: dev + prod (2026-07-12, after manual dev verification). Note: previously deleted votes are not restorable — retention applies only from this migration onward.

---

## 2026-07-12 — Fix member_left push notification titles

No migration. Edge function `push-notification` redeployed to dev + prod with corrected title templates for `member_left` and `member_left_removed`:
- DE `member_left` title: `{{creator}} hat verlassen` → `{{creator}} hat die Reise verlassen`
- EN `member_left_removed` title: `{{creator}} removed` → `{{creator}} was removed`
- DE `member_left_removed` title: `{{creator}} entfernt` → `{{creator}} wurde entfernt`

These now match the in-app i18n strings. Also resolves the root cause where Android push popups showed the raw DB fallback `"Member left"` (the live function predated the `member_left` translation entries from 2026-07-14).

---

## 2026-07-14 — Fix trip_deleted constraint + member_left notification + expense name retention

### Migration: `20260714100000_add_trip_deleted_and_member_left_types`

**Changes:**
- Dropped and recreated `notifications_type_check` to include `'trip_deleted'` (was missing — caused CHECK constraint crash on trip deletion) and `'member_left'` (new type for member removal notifications).

**Non-destructive.** Applied to: dev + prod.

### Migration: `20260714100001_notify_on_member_removal`

**Changes:**
- `CREATE OR REPLACE FUNCTION public.cleanup_votes_on_member_removal()` — extends the existing trigger function to also call `private.create_trip_notification()` with `type='member_left'` after the vote/passenger cleanup. Excludes the departing member from the notification. Sets `context_entity='left'` for self-leave or `'removed'` for organizer kick (detected via `auth.uid() = OLD.user_id`). Skips if the trip has already been soft-deleted.

**Non-destructive.** Applied to: dev + prod.

**Client + edge function changes (same session):**
- `packages/types/src/enums.ts`: Added `'member_left'` to `NOTIFICATION_TYPE`.
- `packages/ui/src/iconColors.ts`: `NOTIFICATION_ICON_COLORS.member_left = person-remove-outline / rose`.
- Edge function `push-notification` deployed to dev + prod: Added `member_left` and `member_left_removed` (virtual key, `context_entity='removed'`) translations (en/de); `preferenceColumn` maps `member_left` → `new_member`.
- `NotificationItem.tsx`: Added `member_left` / `member_left_removed` body templates + `EffectiveNotificationType`.
- `resolveNotificationPath.ts`: `member_left` routes to trip settings (same as `new_member`).
- `packages/i18n/locales/{en,de}/notifications.json`: Added `type.member_left` and `type.member_left_removed` labels.
- `packages/api/src/users.ts`: Added `getUsersByIds(userIds)` to fetch user rows by ID array.
- `apps/mobile/src/features/expenses/hooks/useExpenseParticipants.ts` (new): Hook that merges current members map with former members referenced in expense splits, so expense screens show real names after a user leaves.
- `apps/mobile/app/trip/[id]/expenses.tsx`: Uses `useExpenseParticipants` to build the merged `memberMap`.

---

## 2026-07-13 — Member cleanup + trip deletion notification

### Migration: `20260713100000_cleanup_passengers_prework_on_member_removal`

**Changes:**
- `CREATE OR REPLACE FUNCTION public.cleanup_votes_on_member_removal()` — extends the existing trigger function (from `20260619100000`) to also DELETE `transfer_vehicle_passengers` (via `vehicle_id → transfer_vehicles.trip_id`) and `prework_preferences` (direct `trip_id`) for the departing user. Fixes "Unknown" chips in VehicleCard and GroupSummarySection.
- Existing trigger `trg_cleanup_votes_on_member_removal` on `AFTER DELETE ON trip_members` fires the updated function — no trigger DDL change.

**Non-destructive.** Applied to: dev + prod.

### Migration: `20260713110000_notify_members_on_trip_soft_delete`

**Changes:**
- `CREATE OR REPLACE FUNCTION public.soft_delete_trip()` — adds `private.create_trip_notification()` call with `type='trip_deleted'` BEFORE setting `deleted_at`, so `trip_members` is still queryable. Excludes the organizer from the notification.

**Non-destructive.** Applied to: dev + prod.

**Client changes (same PR):**
- `packages/types/src/enums.ts`: Added `'trip_deleted'` to `NOTIFICATION_TYPE`.
- `packages/ui/src/iconColors.ts`: `NOTIFICATION_ICON_COLORS.trip_deleted = trash-outline / rose`.
- Edge function `push-notification` deployed to dev + prod: Added `trip_deleted` translation (en/de); `preferenceColumn` returns `null` (always-on).
- `NotificationItem.tsx`: Added `trip_deleted` body template + `EffectiveNotificationType`.
- `resolveNotificationPath.ts`: `trip_deleted` routes to `/(tabs)` (trip no longer exists).
- `packages/i18n/locales/{en,de}/notifications.json`: Added `type.trip_deleted` label.

---

## 2026-07-08 — Activity reminder cron

### Migration: `20260708100000_create_activity_reminder_cron`

**Changes:**
1. **New column `notification_preferences.activity_reminder`** — BOOLEAN NOT NULL DEFAULT TRUE. Separate toggle from the existing `reminder` column so users can opt out of activity reminders without losing trip-start reminders and nudges.
2. **New function `private.create_activity_reminders()`** — SECURITY DEFINER, runs every 5 minutes via pg_cron. For each activity where `activity_date IS NOT NULL AND start_time IS NOT NULL AND status NOT IN ('completed', 'skipped') AND deleted_at IS NULL`, converts the naive local time to UTC using `timezone(trip.timezone, activity_date + start_time)` and checks if it falls within `NOW()` to `NOW() + 65 minutes`. Deduplicates via `related_type='activity_reminder' AND related_id=activity.id AND created_at > NOW() - INTERVAL '2 hours'` — time-window based (not calendar day) to avoid false double-sends across the UTC midnight boundary. Calls `private.create_trip_notification()` with `type='reminder'`, `related_type='activity_reminder'`, and context fields.
3. **Cron schedule `create-activity-reminders`** — `*/5 * * * *` (every 5 minutes). Uses the existing push-dispatch pipeline.

**Non-destructive.** Applied to: dev + prod.

**Client changes (same PR):**
- Edge function `push-notification` (deployed to dev + prod): `preferenceColumn()` accepts optional `relatedType`; `reminder + activity_reminder` → `'activity_reminder'` column. `translateNotification()` effectiveType chain + `NOTIFICATION_TRANSLATIONS` entry added.
- Bug fix: `isOngoing()` / `isAutoCompleted()` in `activities.tsx` now accept a `timezone` string and use `dayjs.tz()` for all datetime construction, fixing classification for users whose device timezone differs from the trip timezone.

---

## 2026-07-07 — Delete account (anonymize strategy)

### Migration: `20260707100000_delete_own_account`

**Changes:**
1. **Sentinel user** — inserts `00000000-0000-0000-0000-000000000000` into `auth.users` and `public.users` (name: "Deleted User"). Acts as the permanent FK target for all anonymized content.
2. **New function `public.delete_own_account()`** — `SECURITY DEFINER`, callable by `authenticated`. Single-transaction deletion:
   - Disables user-defined triggers via `SET LOCAL session_replication_role = 'replica'` (scoped to the transaction; bypasses `check_last_organizer` and `restrict_*_update_fields` triggers).
   - Handles last-organizer trips: promotes the earliest-joined other member, or soft-deletes the trip if the caller is the sole member.
   - Reassigns all non-cascading `created_by` / `paid_by` / `settled_by` / `user_id` columns (18 tables) to the sentinel UUID; sets nullable columns (`expenses.updated_by`, `shared_packing_items.claimed_by`, `lost_found_cases.target_user`, `expense_splits.covered_by`) to NULL.
   - Deletes the user's avatar from `storage.objects` (`bucket_id = 'avatars'`).
   - Deletes from `auth.users`, which cascades to `public.users` and all CASCADE-linked tables (`trip_members`, votes, notifications, packing_items, push_tokens, etc.).

**Non-destructive.** Applied to: dev + prod.

---

### Migration: `20260707110000_fix_delete_own_account_cascade`

**Changes:**
1. **Replaced `public.delete_own_account()`** — fixes a critical bug where `session_replication_role = 'replica'` (needed to bypass user-defined triggers during UPDATE statements) also disabled FK CASCADE on the final `DELETE FROM auth.users`. This left `auth.identities`, `auth.sessions`, and `public.users` intact, causing re-signup with the same email to fail with "Database error saving new user" (GoTrue finds the orphaned identity row).
2. **Fix**: explicitly DELETE the caller's `trip_members` rows while still in replica mode (avoiding `check_last_organizer`), then `SET LOCAL session_replication_role = 'origin'` before `DELETE FROM auth.users` so CASCADE propagates normally to all child tables.
3. **Added guest guard**: `RAISE EXCEPTION` if `public.users.is_guest = true` — consistent with the rest of the codebase's guest-restriction pattern.

**Non-destructive.** Applied to: dev + prod.

---

## 2026-07-06 — Invite token preview RPC + example trip trigger + shared packing notification fix

### Migration: `20260706100000_fix_shared_packing_notification_context`

**Changes:**
1. **Updated `private.handle_shared_packing_item_insert()`** — now passes `context_entity`, `context_trip`, `context_creator` to both `create_trip_notification()` calls so the in-app notification body interpolates correctly.
2. **Updated `private.notify_shared_packing_item_claimed()`** — added `v_trip_title` lookup and sets `body` (was NULL), plus populates `context_entity`, `context_trip`, `context_creator` columns.

**Non-destructive.** Applied to: dev + prod.

---

### Migration: `20260706110000_invite_token_preview_rpc`

**Changes:**
1. **New function `public.preview_invite_token(p_token TEXT)`** — read-only RPC callable by `anon` and `authenticated`. Validates the token is not expired/revoked/exhausted and returns `(trip_title, start_date, end_date)`. Returns empty result for invalid tokens. Allows the join screen to show trip name and dates before the user enters their name.

**Non-destructive.** Applied to: dev + prod.

---

### Migration: `20260706120000_create_example_trip_trigger`

**Changes:**
1. **New function `private.trigger_create_example_trip()`** — AFTER INSERT trigger on `public.users`. Skips guests (`is_guest = TRUE`). Initial version reading vault secrets `example_trip_fn_url` + `example_trip_service_role_key`. Superseded by migrations 130000 and 140000.
2. **New trigger `trg_create_example_trip`** on `public.users`.
3. **New Edge Function** `create-example-trip` — creates a full demo trip (trip, 4 activities, activity note, 2 accommodations, 1 flight, shopping list, recipe, 3 expenses, 1 packing item, 1 shared packing item, 1 trip note) for the new user. Guards against duplicate trips.

**Non-destructive.** Applied to: dev + prod.

---

### Migration: `20260706130000_fix_example_trip_trigger_reuse_key`

**Changes:**
1. **Updated `private.trigger_create_example_trip()`** — reuses the existing `push_notification_service_role_key` vault secret instead of requiring a separate `example_trip_service_role_key`. Only vault secrets needed: `example_trip_fn_url` + `push_notification_service_role_key`.

**Non-destructive.** Applied to: dev + prod.

---

### Migration: `20260706140000_simplify_example_trip_trigger`

**Changes:**
1. **Updated `private.trigger_create_example_trip()`** — final form. The `create-example-trip` Edge Function is deployed with `--no-verify-jwt`, so no `Authorization` header is needed. Only vault secret required: `example_trip_fn_url`. The `pg_net` call sends only `Content-Type` and `{ user_id }` in the body.

**Vault secret required (both envs):** `example_trip_fn_url`.
**Non-destructive.** Applied to: dev + prod.

---

## 2026-06-20 — Blocker votes as workflow escalation

### Migration: `20260620000000_blocker_as_workflow_escalation`

**Changes:**
1. **Updated `close_activity_voting()`** — now deletes all `group_blocker` votes from `activity_votes` after setting `voting_open = FALSE`. When an organiser/creator marks a Discuss item as Planned, blockers are removed automatically.
2. **Updated `close_accommodation_voting()`** — same blocker deletion after closing.
3. **Updated `close_transfer_flight_voting()`** — same.
4. **Updated `book_transfer_flight()`** — same; blocker votes deleted after the flight is booked.
5. **New function `auto_finalize_activity_voting_on_blocker_removal()`** — AFTER DELETE trigger on `activity_votes`. When a user removes their `group_blocker` vote, re-evaluates auto-close: if no remaining blockers, `auto_close = true`, and all members have voted, sets `voting_open = FALSE`. Exits early if `voting_open` is already false (prevents loop with step 1).
6. **New trigger `on_activity_vote_deleted`** on `activity_votes`.
7. **New function `auto_finalize_accommodation_voting_on_blocker_removal()`** + **trigger `on_accommodation_vote_deleted`** — same pattern for accommodations.
8. **New function `auto_finalize_flight_voting_on_blocker_removal()`** + **trigger `on_transfer_flight_vote_deleted`** — same pattern for transfer flights.

**Non-destructive.** Applied to: dev + prod.

---

## 2026-06-19 — Vote cleanup on member removal + auto-close blocker guard + review nudge

### Migration: `20260619100000_cleanup_votes_on_member_removal`

**Changes:**
1. **New function `public.cleanup_votes_on_member_removal()`** — AFTER DELETE trigger on `trip_members`. When a user is removed from a trip, deletes their `activity_votes`, `accommodation_votes`, and `transfer_flight_votes` for entities belonging to that trip.
2. **New trigger `trg_cleanup_votes_on_member_removal`** on `trip_members`.

**Non-destructive.** Applied to: dev + prod.

---

### Migration: `20260619110000_prevent_auto_close_with_blocker`

**Changes:**
1. **Updated `auto_finalize_activity_voting()`** — now checks for any `group_blocker` vote before auto-closing. If a blocker vote exists, the trigger exits early without closing voting.
2. **Updated `auto_finalize_accommodation_voting()`** — same blocker guard.
3. **Updated `auto_finalize_flight_voting()`** — same blocker guard.

This keeps activities/accommodations/flights with a blocker vote in the "Discuss" section until explicitly resolved.

**Non-destructive.** Applied to: dev + prod.

---

### Migration: `20260619120000_create_review_nudge_cron`

**Changes:**
1. **Added `review_nudge_sent_at TIMESTAMPTZ`** column to `trips` table.
2. **New function `private.create_review_nudge_notifications()`** — Runs every hour at :15. Finds trips that ended 12+ hours ago with no nudge sent yet. Inserts a `reminder` notification with `related_type='review_nudge'` for all trip members. Sets `review_nudge_sent_at` to prevent duplicates.
3. **pg_cron job `create-review-nudge-notifications`** — Scheduled at `15 * * * *`.

**Applied to:** dev + prod.

---

## 2026-06-17 — Allow members to create prework topics

### Migration: `20260617190516_allow_member_create_prework_topics`

**Changes:**
1. **Dropped** `prework_topics_insert_organizer` RLS policy on `prework_topics`.
2. **Created** `prework_topics_insert_member` RLS policy: any authenticated trip member can INSERT, as long as `created_by = auth.uid()` and `private.is_trip_member(trip_id, auth.uid())`.
3. UPDATE and DELETE policies remain organizer-only.

**Non-destructive:** No schema changes. RLS policy replacement only.

**Applied to:** dev + prod

---

## 2026-06-16 — Feat: Planning Nudge + Guest Conversion Nudge Crons

### Migration: `20260616100000_create_planning_nudge_cron`

**Changes:**
1. **New function `private.create_planning_nudge_notifications()`** — Runs every Monday at 11:00 UTC. Finds users whose most recently ended trip ended 14+ days ago and who have no trip that ended within the last 14 days or is upcoming (i.e., their most recent trip is truly 14+ days old). Inserts one `reminder` notification per user with `related_type='planning_nudge'`. Dedup: skips if a `planning_nudge` was already sent to the user in the last 14 days.
2. **pg_cron job `create-planning-nudge-notifications`** — Scheduled at `0 11 * * 1` (Mondays 11:00 UTC).
3. **No schema changes** — Uses existing `'reminder'` notification type; `related_type` is free-form TEXT. Notification is attached to the user's most recent completed trip ID.

### Migration: `20260616110000_create_guest_nudge_cron`

**Changes:**
1. **New function `private.create_guest_nudge_notifications()`** — Runs daily at 12:00 UTC. Targets `participant` or `guest` members whose trip ended exactly 1 day ago and who have never been an organizer of any trip. Inserts one `reminder` notification per user+trip with `related_type='guest_nudge'`. Dedup: skips if a `guest_nudge` already exists for the same user+trip combination.
2. **pg_cron job `create-guest-nudge-notifications`** — Scheduled at `0 12 * * *` (daily 12:00 UTC).
3. **No schema changes** — Same `reminder` type, `guest_nudge` related_type.

**Client-side changes (not migrations):**
- `supabase/functions/push-notification/index.ts`: Added `planning_nudge` and `guest_nudge` virtual translation types (en/de). Routing via effectiveType: `type === 'reminder' && relatedType === 'planning_nudge'` and `type === 'reminder' && relatedType === 'guest_nudge'`.

**Non-destructive:** No schema changes. Two new pg_cron jobs only.

**Applied to:** dev + prod

---

## 2026-06-15 — Feat: Post-Trip Expense Reminder Cron

### Migration: `20260615100000_create_expense_reminder_cron`

**Changes:**
1. **New function `private.create_expense_reminders()`** — Runs daily at 10:00 UTC via pg_cron. Finds trips where `end_date < CURRENT_DATE` and `(today - end_date) IN (1, 3, 7)`. For each such trip, computes unsettled balances inline (cannot use `get_trip_balances` — no `auth.uid()` in cron context), skips trips where all balances are negligible (< 0.01). Creates a `reminder` notification for ALL members via `private.create_trip_notification()` with `related_type='expense_reminder'`.
2. **Deduplication** — Skips if a reminder with `body LIKE '%unsettled expenses%'` was already created today for the trip.
3. **pg_cron job `create-expense-reminders`** — Scheduled at `0 10 * * *` (1 hour after the trip-start reminder job).
4. **No schema changes** — Uses existing `'reminder'` notification type; `related_type` is free-form TEXT.

**Client-side changes (not migrations):**
- `supabase/functions/push-notification/index.ts`: Added `expense_reminder` virtual translation type (en/de). Detection: `type === 'reminder' && dbBody?.includes('unsettled expenses')`.
- `apps/mobile/src/features/notifications/utils/resolveNotificationPath.ts`: Routes `related_type === 'expense_reminder'` to `/trip/${trip_id}?tab=Expenses`.

**Non-destructive:** No schema changes. New pg_cron job only.

**Applied to:** dev + prod

---

## Project Details
- **Project:** dev
- **Project ID:** aejywkbkcwyanhyzhrle
- **Region:** eu-west-3
- **Database:** PostgreSQL 17.6

---

## 2026-06-13 — Fix: settle_all_expenses — Simplified Settlements in Receipt Snapshot

### Migration: `20260613110000_fix_settle_all_snapshot`

**Changes:**
1. **`settle_all_expenses` RPC replaced** — Same behavior, but the receipt snapshot now stores the greedy min-payment paths (exact port of `computeSettlements` in TypeScript) instead of raw `(debtor, creditor)` pair aggregates. Net balances are computed inline (same formula as `get_trip_balances`) before any UPDATEs.
2. **`total_amount` changed** — Now equals the sum of the simplified transfer amounts, not the sum of every individual split.
3. **`NULL::TEXT` cast** — `context_entity` parameter passed with explicit type cast to avoid parameter-binding ambiguity.

**Non-destructive:** `CREATE OR REPLACE FUNCTION` — no schema changes. Existing receipt rows (if any from testing) remain; only future receipts use the new algorithm.

**Applied to:** dev + prod

---

## 2026-06-13 — Feat: Global Settle All with Immutable Transaction Receipts

### Migration: `20260613100000_settle_all_and_receipts`

**Changes:**
1. **New table `settlement_receipts`** — Stores an immutable receipt for every "Settle All" action. Columns: `id`, `trip_id`, `settled_by`, `currency`, `total_amount`, `splits_count`, `snapshot` (JSONB with frozen member names and settlement pairs), `created_at`.
2. **RLS on `settlement_receipts`** — SELECT: trip members only. INSERT/UPDATE/DELETE: all denied via `WITH CHECK (false)` / `USING (false)`. Only the SECURITY DEFINER RPC can insert.
3. **Realtime** — Table added to `supabase_realtime` publication.
4. **`notifications_type_check` extended** — Added `'expense_settlement'` to the allowed type values.
5. **New RPC `settle_all_expenses(p_trip_id UUID) RETURNS UUID`** — Settles ALL open splits across all debtor→creditor pairs in one atomic transaction, cascades cover-expense splits, builds a frozen JSONB snapshot with user names, inserts a receipt row, and calls `private.create_trip_notification` with type `'expense_settlement'`. Returns the receipt UUID. Raises exception if no open splits exist (prevents empty receipts).

**Non-destructive:** The existing `settle_all_for_pair` RPC is kept. New table and new RPC only.

**Applied to:** dev + prod

---

## 2026-06-13 — Security Fix: Validate target_user Membership in Lost & Found Cases

### Migration: `20260613000001_fix_lost_found_target_user_membership`

**Changes:**
1. **`restrict_lost_found_target_user` trigger** (BEFORE INSERT OR UPDATE on `lost_found_cases`) — Raises an exception if `target_user` is set to a UUID that is not a member of the trip. Prevents bad data from being stored at the source.
2. **`notify_new_lost_found_case` trigger function** (defense-in-depth) — Added `private.is_trip_member` check before inserting the notification for `target_user`. Even if the row guard above is bypassed, no notification reaches a non-member user.

**Security impact:** Without this fix any authenticated trip member could deliver a push notification with attacker-controlled text (up to 100 chars) to any user on the platform by supplying an arbitrary UUID as `target_user`. Combined with the unrestricted `users_select_authenticated` policy (any user can read all profiles), this allowed platform-wide push notification spam.

**Non-destructive:** Only affects new inserts/updates where `target_user` is not a trip member — previously invalid data would have been rejected by the notification logic anyway. No existing rows are modified.

**Applied to:** dev + prod

---

## 2026-06-12 — Feat: Add USD Currency Support

### Migration: `20260612140000_add_usd_currency`

**Changes:**
1. **`trips_base_currency_check`** — Replaced CHECK constraint to include `'USD'` alongside `'EUR'` and `'CHF'`.
2. **`expenses_currency_check`** — Replaced CHECK constraint to include `'USD'` alongside `'EUR'` and `'CHF'`.

**Non-destructive:** existing rows are unaffected; only new rows can use `'USD'`. Fully backwards-compatible.

**Applied to:** dev + prod

**App-layer changes:** `CURRENCY` constant in `packages/types/src/enums.ts` updated to `['EUR', 'CHF', 'USD']`; `CURRENCY_SYMBOLS` in `packages/utils/src/format.ts` gains `USD: '$'`; Zod schemas, TypeScript types, and UI currency pickers all derive from the constant automatically.

---

## 2026-06-12 — Fix: Activity Note Notifications + Lost & Found Case Type Editability

### Migration: `20260612120000_activity_note_notif_and_lost_found_case_type`

**Changes:**
1. **`notifications_type_check`** — Extended to include `'activity_note'` as a valid notification type.
2. **`restrict_lost_found_case_update_fields()`** — Removed the `case_type` immutability guard. `trip_id` and `created_by` remain immutable; `case_type` is now freely editable. Fixes the "Cannot change case_type" error when users switch a case between "person unknown / known" variants.
3. **`private.notify_activity_note_added()`** — New AFTER INSERT trigger on `activity_notes`. Notifies all trip members (except the note author) when a note is added. Gated on the `new_activity` preference column. Context columns populated (activity title as entity, trip title, creator name).

**Applied to:** dev + prod

---

## 2026-06-11 — Fix: Push Edge Function Invocation Flood

### Migration: `20260611180000_fix_push_invocation_flood`

**Why:** ~56 notifications with `push_sent_at IS NULL` were being retried every 5 minutes indefinitely, producing ~56 edge function invocations per 5-minute window (228k on dev, 111k on prod in 2.5 weeks). Three root causes found:

**Root cause 1:** `dispatch_pending_push_notifications` had no age limit. Before the June 11 "always mark `push_sent_at`" fix, any notification sent to a user with no push tokens or with preferences off was never marked as sent. Each such row was retried every 5 minutes forever.

**Root cause 2:** Migration `20260611172912` regressed `send_organizer_nudge` in three ways:
- Rate limit reverted to `COUNT(*)` — for a trip with N members, 1 nudge creates N-1 rows, exceeding the limit after `floor(3/(N-1))` nudges instead of 3.
- `related_type` set to `NULL` — trip reminder notifications (also `type='reminder'`) counted against the nudge rate limit.
- `context_trip` set to `v_trip_title` — broke the edge function's `isNudge` detection (`isNudge = type==='reminder' && !context?.trip`), causing nudge push notifications to display the generic "Trip reminder" template instead of the organizer's custom title/body.

**Root cause 3:** No structural guard against permanent retry accumulation (any future transient edge function failure leaves a notification stuck forever).

**Changes:**
- One-time `UPDATE notifications SET push_sent_at = NOW() WHERE push_sent_at IS NULL` clears all currently-stuck rows immediately
- `dispatch_pending_push_notifications()` rewritten to auto-expire notifications older than 24 hours (marks as sent without HTTP call) before the dispatch loop — prevents permanent accumulation
- `send_organizer_nudge` restored to the correct version from `20260523195815`: `COUNT(DISTINCT related_id) WHERE related_type = 'nudge'` for accurate rate limiting; `context_trip = NULL` to preserve the isNudge detection in the edge function; `related_type = 'nudge'` and `related_id = v_nudge_id` for correct distinguishing of nudges vs trip reminders

**Expected result:** Edge function invocations drop to ≤ 1 per actual user action (nudge RPC) or ≤ N per notification batch, with no background flood.

**Applied to:** dev + prod

---

## 2026-06-10 — Bug Fix Batch: Auto-close Voting, Lost & Found, Push Context

### Migration: `20260610100000_fix_activity_auto_close_trigger_depth`

**Why:** Migration `20260531100000` recreated `check_activity_update_permissions` to guard `auto_close` but dropped the `pg_trigger_depth() > 1` bypass from `20260513000001`. When `auto_finalize_activity_voting()` (at trigger depth 1) set `voting_open=FALSE`, the permission check fired at depth 2 with `auth.uid()` = the voter (not organizer) → exception. Also fixed the "already voted but auto_close toggled ON after the fact" edge case.

**Changes:**
- Recreated `check_activity_update_permissions` with `pg_trigger_depth() > 1` bypass restored
- Added `retroactive_auto_close_activity` BEFORE UPDATE trigger: when organizer sets `auto_close=TRUE` and all members have already voted, closes voting immediately in the same statement

---

### Migration: `20260610110000_lost_found_notification_improvements`

**Why:** When a lost/found case had `target_user IS NOT NULL` (e.g. "found item, owner known"), only the owner received a notification — other trip members were silently excluded. Also, no notification was sent when a case was resolved.

**Changes:**
- Rewrote `notify_new_lost_found_case()`: when `target_user IS NOT NULL`, sends a targeted personal notification to the owner AND broadcasts a general notification to all other members (excluding creator and owner)
- Added `notify_lost_found_resolved()` AFTER UPDATE trigger: when `is_resolved` changes FALSE→TRUE, broadcasts a resolution notification to all trip members

---

### Migration: `20260610120000_fix_dispatch_polling_context`

**Why:** `dispatch_pending_push_notifications()` (from `20260527000001`) selected only 9 notification columns — missing `context_entity`, `context_trip`, `context_creator` added in `20260608200000`. Notifications dispatched via polling (all trigger-sourced ones) were delivered without translation context, so the edge function always fell back to English. `create_trip_reminders()` also didn't pass `context_trip`, so trip-reminder push bodies couldn't be translated per-user.

**Changes:**
- Recreated `dispatch_pending_push_notifications()` to SELECT and forward all three context columns in HTTP payload
- Recreated `create_trip_reminders()` to pass `context_trip = v_trip.title` to `create_trip_notification`

**Edge function update** (`supabase/functions/push-notification/index.ts`):
- Updated `reminder` translation template to trip-reminder text (`"Trip reminder"` / `"Reiseerinnerung"`)
- `translateNotification` now distinguishes nudges from trip reminders by checking `context?.trip`: nudges (no context) use DB title/body as-is; trip reminders (context_trip set) use the translated template

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) + prod (`fsfsqghbejwvgxujoyne`). Edge function deployed to both.

---

## 2026-06-11 — 14-Task Batch: Notifications, Accommodation Notes, Booking Dates

### Migration: `20260611172912_fix_create_trip_notification_overload`

**Why (Tasks 13 + 14):** `20260608200000` added a 10-param overload of `private.create_trip_notification` without dropping the original 7-param version. PostgreSQL rejected calls with `NULL` arguments (type `unknown`) because it could not resolve the overload → `send_organizer_nudge` errored. The same migration also removed the `pg_trigger_depth() >= 1` guard, so every trigger-fired notification immediately attempted `net.http_post()` which pg_net silently drops at trigger depth ≥ 1 → notifications stayed with `push_sent_at IS NULL` and were retried by pg_cron every 5 minutes forever.

**Changes:**
- `DROP FUNCTION private.create_trip_notification(7 params)` — removes ambiguous overload
- Rewrote 10-param version: restores `pg_trigger_depth() >= 1` guard (returns early, lets pg_cron handle push dispatch)
- Updated `send_organizer_nudge` to call 10-param signature with explicit `NULL::TEXT, NULL::UUID, NULL::TEXT` for context params
- Updated `dispatch_pending_push_notifications` to SELECT + forward `context_entity`, `context_trip`, `context_creator` columns
- Added `notify_lost_found_target_user_changed()` trigger (Task 11): fires AFTER UPDATE when `target_user` changes to non-NULL on an open case — sends personal notification to target
- Extended `notify_lost_found_resolved()` (Task 12): now handles TRUE→FALSE (re-open) direction — broadcasts reopen notification + personal notification to `target_user` if set

**Applied to:** dev + prod

---

### Migration: `20260611172915_create_accommodation_notes`

**Why (Task 8):** Collaborative free-text notes attached to individual accommodation bases, mirroring `activity_notes`.

**Table created:** `public.accommodation_notes`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| accommodation_id | UUID | FK → accommodations(id) ON DELETE CASCADE |
| trip_id | UUID | NOT NULL, auto-populated by BEFORE INSERT trigger |
| created_by | UUID | FK → users(id) |
| content | TEXT | NOT NULL, 1–1000 chars |
| created_at / updated_at | TIMESTAMPTZ | Auto-maintained |

**RLS:** SELECT (trip member + parent not deleted), INSERT (member + own created_by), UPDATE (owner), DELETE (owner or organizer)

**Applied to:** dev + prod

---

### Migration: `20260611172918_add_accommodation_booking_dates`

**Why (Task 6):** Allow organizers to mark an accommodation as "Booked" with concrete check-in and check-out dates. Multiple bases per trip can be booked.

**Changes:** Added `check_in_date DATE` and `check_out_date DATE` nullable columns to `public.accommodations`.

**Applied to:** dev + prod

---

### Edge function update (`push-notification/index.ts`)

**Why (Tasks 9 + 13):**
- Task 13: `handleSingle` and `handleBatch` early-returned (no tokens, preferences off) without marking `push_sent_at` → pg_cron retried forever. Fixed: always mark `push_sent_at` on every code path.
- Task 9: Added `lost_found_found` / `lost_found_lost` virtual translation types. Detected via `fallbackTitle` matching (`'Item found'` / `'Item lost'`) so personal notifications to tagged members show specific translated titles instead of generic "Lost or Found".

**Applied to:** dev + prod

---

## 2026-06-03 — Activity Notes Feature

### Migrations: `20260603100000_create_activity_notes` + `20260603100001_fix_activity_notes_trip_id_nullable`

**Why:** Collaborative notes/suggestions attached to individual activities. Any trip member can add free-text tips (e.g., "Try the rooftop bar at Hotel X"), visible to all members when the activity detail is expanded.

**Table created:** `public.activity_notes`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| activity_id | UUID | FK → activities(id) ON DELETE CASCADE |
| trip_id | UUID | Nullable, auto-populated by BEFORE INSERT trigger from parent activity |
| created_by | UUID | FK → users(id) |
| content | TEXT | NOT NULL, 1–1000 chars |
| created_at | TIMESTAMPTZ | Default NOW() |
| updated_at | TIMESTAMPTZ | Auto-maintained by set_updated_at() trigger |

**Key design decisions:**
- `trip_id` is denormalized (nullable, trigger-populated) — matches the `activity_votes` pattern for efficient RLS filtering without JOINs
- The BEFORE INSERT trigger also validates parent activity is not soft-deleted; raises exception if not found
- Hard delete (no `deleted_at`) — matches `trip_notes`
- No realtime subscription — low-frequency feature; query invalidation on mutation only

**RLS policies:**
- SELECT: `is_trip_member(trip_id)` + parent activity not soft-deleted
- INSERT: `created_by = auth.uid()` + `is_trip_member` + parent activity not soft-deleted
- UPDATE: `created_by = auth.uid()` (owner only)
- DELETE: `created_by = auth.uid()` OR `is_trip_organizer` (owner + organizer)

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) + prod (`fsfsqghbejwvgxujoyne`)

---

## 2026-05-23 — Phase 8: Notifications

### Migration: `20260522213020_create_push_tokens`

**Why:** Store Expo push tokens per user/device so the Edge Function can deliver push notifications to the correct device. Tokens are upserted on login and deleted on logout — lifecycle managed in code to prevent ghost pushes.

**Table created:** `public.user_push_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID FK → users CASCADE | |
| `push_token` | TEXT | Expo push token |
| `platform` | TEXT | CHECK ('ios', 'android') |
| `created_at` | TIMESTAMPTZ | `DEFAULT NOW()` |
| `updated_at` | TIMESTAMPTZ | `DEFAULT NOW()`, trigger-maintained |
| UNIQUE | `(user_id, push_token)` | enables upsert semantics |

**RLS:** SELECT/INSERT/UPDATE/DELETE own rows only (`auth.uid() = user_id`).

**RPCs:**
- `upsert_push_token(p_push_token TEXT, p_platform TEXT)` — SECURITY DEFINER; upserts on `(user_id, push_token)` conflict, updates `updated_at`
- `delete_push_token(p_push_token TEXT)` — SECURITY DEFINER; deletes own token by value

---

### Migration: `20260522213020_create_notifications`

**Why:** Central store for all in-app notifications. Created by DB triggers (never by the client directly). Polled every 30 seconds by TanStack Query — no realtime channel needed.

**Table created:** `public.notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `trip_id` | UUID FK → trips CASCADE | |
| `user_id` | UUID FK → users CASCADE | recipient |
| `type` | TEXT | CHECK (8 types: `new_activity`, `vote_finalized`, `vote_update`, `expense_change`, `new_member`, `schedule_change`, `reminder`, `document_access_request`) |
| `title` | TEXT | |
| `body` | TEXT nullable | |
| `related_type` | TEXT nullable | entity type for deep linking (`activity`, `accommodation`) |
| `related_id` | UUID nullable | entity id for deep linking |
| `is_read` | BOOLEAN | `DEFAULT FALSE` |
| `push_sent_at` | TIMESTAMPTZ nullable | set by Edge Function on successful push delivery |
| `created_at` | TIMESTAMPTZ | `DEFAULT NOW()` |

**Indexes:** `(user_id, is_read, created_at DESC)`, `(trip_id, user_id, created_at DESC)`

**RLS:**
- SELECT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- INSERT: `WITH CHECK (false)` — all creates go through SECURITY DEFINER triggers
- DELETE: `auth.uid() = user_id`

**Trigger:** `restrict_notification_update_fields()` BEFORE UPDATE — raises exception if any column other than `is_read` or `push_sent_at` is modified.

**RPCs:**
- `mark_notification_read(p_notification_id UUID)` — SECURITY DEFINER; verifies ownership, sets `is_read = true`
- `mark_all_notifications_read(p_trip_id UUID DEFAULT NULL)` — SECURITY DEFINER; marks all unread for caller (optionally filtered by trip)
- `get_unread_notification_count(p_trip_id UUID DEFAULT NULL)` — SECURITY DEFINER STABLE; returns unread count for caller

---

### Migration: `20260522213021_create_notification_preferences`

**Why:** Control push delivery per trip per notification type. In-app notifications are always created; these flags determine whether the Edge Function actually sends a push. Rows are auto-created when a user joins a trip (all preferences default to `TRUE`).

**Table created:** `public.notification_preferences`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users CASCADE | |
| `trip_id` | UUID FK → trips CASCADE | |
| `new_activity` | BOOLEAN | `DEFAULT TRUE` |
| `vote_update` | BOOLEAN | `DEFAULT TRUE` |
| `expense_change` | BOOLEAN | `DEFAULT TRUE` |
| `new_member` | BOOLEAN | `DEFAULT TRUE` |
| `schedule_change` | BOOLEAN | `DEFAULT TRUE` |
| `reminder` | BOOLEAN | `DEFAULT TRUE` |
| UNIQUE | `(user_id, trip_id)` | |

**RLS:** SELECT/UPDATE own rows only. INSERT denied — created by trigger.

**Trigger:** `auto_create_notification_preferences()` SECURITY DEFINER AFTER INSERT on `trip_members` — inserts preference row with all defaults, `ON CONFLICT DO NOTHING`.

---

### Migration: `20260522213021_create_notification_helpers`

**Why:** Centralize the fan-out logic (one notification per trip member) in a single SECURITY DEFINER function so event triggers stay simple.

**Functions:**
- `private.create_trip_notification(p_trip_id, p_exclude_user_id, p_type, p_title, p_body, p_related_type, p_related_id)` — SECURITY DEFINER, `SET search_path = ''`; loops over `trip_members WHERE trip_id = p_trip_id AND user_id != p_exclude_user_id`; INSERTs one `notifications` row per member (each INSERT fires the push trigger)
- `send_organizer_nudge(p_trip_id UUID, p_title TEXT, p_body TEXT)` — SECURITY DEFINER; validates caller is organizer via `private.is_trip_organizer()`; rate-limits to 3 nudges per trip per hour; calls `private.create_trip_notification` with type `'reminder'`

---

### Migration: `20260522213022_create_notification_push_trigger`

**Why:** Deliver push notifications asynchronously without blocking the DB transaction. `pg_net` makes an HTTP POST to the Edge Function as a fire-and-forget call.

**Extension:** `CREATE EXTENSION IF NOT EXISTS pg_net`

**Vault secrets (stored via `vault.create_secret()`):**
- `push_notification_edge_fn_url` — deployed Edge Function URL
- `push_notification_service_role_key` — service_role key for Edge Function auth

**Trigger function:** `private.dispatch_push_notification()` — AFTER INSERT on `notifications` FOR EACH ROW, SECURITY DEFINER, `SET search_path = ''`
- Reads URL and key from `vault.decrypted_secrets`
- Calls `net.http_post(url, body, headers)` with the notification row serialized as JSON
- Fire-and-forget: the DB transaction does not wait for the HTTP response

**⚠️ Important:** After deploying the Edge Function, populate the vault secrets:
```sql
SELECT vault.create_secret('<edge-fn-url>', 'push_notification_edge_fn_url');
SELECT vault.create_secret('<service-role-key>', 'push_notification_service_role_key');
```

---

### Migration: `20260522213022_create_notification_event_triggers`

**Why:** Translate product events into notifications without any client involvement. All SECURITY DEFINER, `SET search_path = ''`.

| Trigger | Table | Event | Type | Exclude |
|---|---|---|---|---|
| `notify_new_activity` | `activities` | AFTER INSERT | `new_activity` | `NEW.created_by` |
| `notify_new_expense` | `expenses` | AFTER INSERT | `expense_change` | `NEW.created_by` |
| `notify_new_member` | `trip_members` | AFTER INSERT | `new_member` | `NEW.user_id` |
| `notify_activity_vote_finalized` | `activities` | AFTER UPDATE WHERE `OLD.voting_open AND NOT NEW.voting_open` | `vote_finalized` | nil (notify all) |
| `notify_accommodation_vote_finalized` | `accommodations` | AFTER UPDATE WHERE `OLD.voting_open AND NOT NEW.voting_open` | `vote_finalized` | nil (notify all) |
| `notify_schedule_change` | `activities` | AFTER UPDATE WHERE date/time changed | `schedule_change` | `auth.uid()` |
| `notify_document_access_request` | `document_access_requests` | AFTER INSERT | `document_access_request` | `NEW.requested_by` |

**Guard on `notify_schedule_change`:** `pg_trigger_depth() > 1` early return prevents cascade loops (e.g., when `notify_activity_vote_finalized` updates an activity, `notify_schedule_change` would otherwise fire too).

**`related_type` propagation:** `notify_activity_vote_finalized` sets `related_type = 'activity'`; `notify_accommodation_vote_finalized` sets `related_type = 'accommodation'` — used by `resolveNotificationPath` to route accommodation vote notifications to the Base tab vs. Activities tab.

---

### Edge Function: `supabase/functions/push-notification/index.ts`

Receives notification data from the `pg_net` trigger. Logic:

1. Auth: validates `Authorization: Bearer <service_role_key>` header
2. Checks `notification_preferences` for `(user_id, trip_id)`; maps type → preference column (`vote_finalized`/`vote_update` → `vote_update`; `document_access_request` → always-on)
3. Fetches `user_push_tokens` for user; if empty, returns 200 early
4. POSTs to `https://exp.host/--/api/v2/push/send` with `data: { notificationId, tripId, type, relatedType, relatedId }` for deep-link tap handling
5. On `DeviceNotRegistered` ticket: deletes stale token from `user_push_tokens`
6. Updates `push_sent_at` on success

**Not yet deployed** — run `supabase functions deploy push-notification`, then populate vault secrets (see above).

---

### Code changes (Phase 8)

**New files:**
- `supabase/migrations/20260522213020_create_push_tokens.sql`
- `supabase/migrations/20260522213020_create_notifications.sql`
- `supabase/migrations/20260522213021_create_notification_preferences.sql`
- `supabase/migrations/20260522213021_create_notification_helpers.sql`
- `supabase/migrations/20260522213022_create_notification_push_trigger.sql`
- `supabase/migrations/20260522213022_create_notification_event_triggers.sql`
- `supabase/functions/push-notification/index.ts`
- `packages/api/src/notifications.ts`, `packages/api/src/pushTokens.ts`
- `packages/types/src/notifications.ts` — `NUDGE_MESSAGES` constant
- `apps/mobile/src/features/notifications/hooks/` — `useNotifications.ts`, `useUnreadCount.ts`, `useNotificationPreferences.ts`, `useSendNudge.ts`, `usePushNotificationHandler.ts`
- `apps/mobile/src/features/notifications/utils/` — `registerForPushNotifications.ts`, `resolveNotificationPath.ts`
- `apps/mobile/src/features/notifications/components/` — `NotificationItem.tsx`, `EmptyNotifications.tsx`, `NotificationPreferencesSection.tsx`, `NudgeSheet.tsx`, `TripNotificationBell.tsx`
- `apps/mobile/app/(tabs)/notifications.tsx`
- `apps/mobile/app/trip/[id]/notifications.tsx`
- `apps/mobile/app/trip/[id]/overview.tsx` (OverviewTab; was `index.tsx`)

**Modified files:**
- `packages/types/src/enums.ts` — added `'document_access_request'` to `NOTIFICATION_TYPE`
- `packages/types/src/database.ts` — `UserPushToken` interface; `push_sent_at` on `Notification`
- `packages/types/src/schemas.ts` — `updateNotificationPreferencesSchema`
- `packages/types/src/index.ts` — exports `./notifications`
- `packages/api/src/database.types.ts` — regenerated from remote project
- `packages/api/src/index.ts` — exports notifications + pushTokens
- `apps/mobile/src/stores/authStore.ts` — `pushToken` state + `setPushToken` action
- `apps/mobile/src/features/auth/hooks/useSignOut.ts` — `deletePushToken` before `signOut`
- `apps/mobile/app/_layout.tsx` — push registration + notification handler setup
- `apps/mobile/app/(tabs)/_layout.tsx` — 4th Notifications tab + red badge
- `apps/mobile/app/trip/[id]/_layout.tsx` — replaced with `<Stack>`; custom trip UI moved to `index.tsx`
- `apps/mobile/app/trip/[id]/index.tsx` — now contains the full custom trip UI (formerly `_layout.tsx`)
- `apps/mobile/app/trip/[id]/settings.tsx` — `NotificationPreferencesSection` + `NudgeSheet`
- `apps/mobile/app.config.ts` — `expo-notifications` plugin

---

## 2026-05-25 — Phase 7e: Trip Notes

### Migration: `20260525000005_create_trip_notes`

**Why:** Trip members need a lightweight, shared notepad per trip — free-text notes with a title and optional description, visible to all members, editable by the author, deletable by the author or trip organizer.

**Table created:** `public.trip_notes`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `trip_id` | UUID FK → trips CASCADE | |
| `created_by` | UUID FK → users | |
| `title` | TEXT | `char_length <= 100` CHECK |
| `description` | TEXT nullable | `char_length <= 1000` CHECK |
| `created_at` | TIMESTAMPTZ | `DEFAULT NOW()` |
| `updated_at` | TIMESTAMPTZ | `DEFAULT NOW()`, maintained by trigger |

**Index:** `idx_trip_notes_trip_id ON trip_notes (trip_id)`

**RLS policies:**
- SELECT: `private.is_trip_member(trip_id, auth.uid())`
- INSERT: member + `created_by = auth.uid()`
- UPDATE: `created_by = auth.uid()` (creator only)
- DELETE: `created_by = auth.uid()` OR `private.is_trip_organizer(trip_id, auth.uid())`

**Triggers:**
- `trip_notes_updated_at` (BEFORE UPDATE) — calls `public.set_updated_at()`
- `on_trip_note_update_restrict` (BEFORE UPDATE) — `restrict_trip_note_update_fields()` raises exception if `trip_id` or `created_by` is changed

**No realtime publication** — notes are low-frequency, queries invalidate on mutation.

**No soft delete** — hard delete; no audit trail needed for notes content.

**Code changes:**
- `supabase/migrations/20260525000005_create_trip_notes.sql` — migration
- `packages/types/src/database.ts` — `TripNote` interface
- `packages/types/src/schemas.ts` — `createTripNoteSchema`, `updateTripNoteSchema`, `CreateTripNoteInput`, `UpdateTripNoteInput`
- `packages/api/src/notes.ts` — `getNotes`, `createNote`, `updateNote`, `deleteNote`
- `packages/api/src/index.ts` — exports for notes functions
- `apps/mobile/src/features/notes/hooks/useNotes.ts` — `useNotes`, `useCreateNote`, `useUpdateNote`, `useDeleteNote`
- `apps/mobile/src/features/notes/components/` — `EmptyNotes`, `NoteCard`, `CreateNoteSheet`, `EditNoteSheet`
- `apps/mobile/app/trip/[id]/notes.tsx` — Notes tab screen
- `apps/mobile/app/trip/[id]/_layout.tsx` — `'Notes'` tab registered between Recipes and Settings

---

## 2026-05-23 — Realtime Scaling: Denormalize `trip_id` to Child Tables

### Migration: `20260523000001_denormalize_trip_id_for_realtime_filters`

**Why:** Supabase Realtime `postgres_changes` subscriptions on child tables (votes, passengers,
splits, shopping items) had no `filter` parameter because those tables had no `trip_id` column.
Without a filter, Supabase delivers all events to all subscribers — O(events × subscribers) load.
This fixes the root cause by adding a denormalized `trip_id` to each child table.

**Tables modified (7):**

| Table | Parent FK | Backfill path |
|---|---|---|
| `activity_votes` | `activity_id` | `activities.trip_id` |
| `accommodation_votes` | `accommodation_id` | `accommodations.trip_id` |
| `transfer_flight_votes` | `flight_id` | `transfer_flights.trip_id` |
| `transfer_flight_passengers` | `flight_id` | `transfer_flights.trip_id` |
| `transfer_vehicle_passengers` | `vehicle_id` | `transfer_vehicles.trip_id` |
| `expense_splits` | `expense_id` | `expenses.trip_id` |
| `shopping_items` | `shopping_list_id` | `shopping_lists.trip_id` |

**Per table:** Added `trip_id UUID NOT NULL REFERENCES trips(id)`, backfilled existing rows,
created index on `trip_id`, added BEFORE INSERT trigger (`trg_set_{table}_trip_id`) that
auto-populates `trip_id` from the parent row — works correctly inside SECURITY DEFINER RPCs.

**Additional:**
- `shopping_items` set to `REPLICA IDENTITY FULL` (required for DELETE event payloads to include `trip_id`)
- `restrict_shopping_item_update_fields()` updated to also block `trip_id` mutation

**API layer changes:**
- Added `filter: trip_id=eq.${tripId}` to all previously-unfiltered realtime subscriptions in
  `activities.ts`, `accommodations.ts`, `expenses.ts`, `transferFlights.ts`, `transferVehicles.ts`, `shopping.ts`
- Replaced N-channel global calendar realtime (`useGlobalCalendarRealtime`) with `refetchInterval: 30_000`
  on `useGlobalCalendarActivities` — deleted `useGlobalCalendarRealtime.ts`

---

## 2026-05-24 — Trips Realtime: Propagate edits to all members

### Migration: `20260524000003_enable_trips_realtime`

Added `public.trips` to the Supabase Realtime publication so UPDATE events (title, description, dates, budget, timezone, currency) are delivered to all trip members in real time.

**Realtime publication addition:**
- `public.trips` — live UPDATE events

**REPLICA IDENTITY:** DEFAULT is sufficient — the subscription filter uses `id=eq.{tripId}` and `id` is the primary key, which is always present in the WAL record without FULL.

**Architecture:**
- One channel per trip: `trip-details:{tripId}` (mounted in the trip layout, active for all tabs)
- On UPDATE: surgically patches `['trips', tripId]` cache with `setQueryData`, preserving the joined `member_count` field; invalidates the top-level `['trips']` list so the home screen card stays in sync
- Follows standard exponential backoff reconnection [2s, 5s, 10s, 30s] and AppState foreground resubscription pattern

**Code changes:**
- `supabase/migrations/20260524000003_enable_trips_realtime.sql` — migration
- `packages/api/src/trips.ts` — added `subscribeToTripRealtime`, `unsubscribeFromTrip`, `TripRealtimeCallbacks`
- `packages/api/src/index.ts` — exported new symbols
- `apps/mobile/src/features/trips/hooks/useTripRealtime.ts` — new hook
- `apps/mobile/app/trip/[id]/_layout.tsx` — mounts `useTripRealtime(id!)`

---

## 2026-05-24 — Performance & Scaling: RLS Simplification, Indexes, Position Trigger, Count RPC

### Migration: `20260524000001_rls_indexes_position_trigger`

**Why:** Four child tables (`activity_votes`, `accommodation_votes`, `expense_splits`, `shopping_items`) had
RLS SELECT policies that JOINed back to the parent table to find `trip_id`. Now that these tables have a
denormalized `trip_id` directly (from the 2026-05-23 migration), the JOINs are unnecessary — this migration
rewrites those policies to use `private.is_trip_member(trip_id, auth.uid())` directly. Also adds composite
indexes for hot query paths and an atomic position trigger for shopping items.

**RLS policies rewritten (SELECT — eliminates parent JOIN):**
- `activity_votes`: removed JOIN to `activities`
- `accommodation_votes`: removed JOIN to `accommodations`
- `expense_splits`: removed JOIN to `expenses`
- `shopping_items`: removed JOIN to `shopping_lists` on SELECT, INSERT, and UPDATE

**Indexes added:**
- `idx_shopping_items_list_position ON shopping_items(shopping_list_id, position) WHERE deleted_at IS NULL`
- `idx_activities_trip_date ON activities(trip_id, activity_date) WHERE deleted_at IS NULL AND activity_date IS NOT NULL`
- `idx_expense_splits_expense_status ON expense_splits(expense_id, status)`

**Position trigger added:**
- `trg_set_shopping_item_position` (BEFORE INSERT) — atomically assigns `position = MAX(position)+1`
  within the transaction, eliminating the client-side SELECT-max + INSERT double round-trip and the
  associated race condition under concurrent inserts.

### Migration: `20260524000002_shopping_lists_count_fn`

**Why:** `getShoppingLists` previously fetched all item rows client-side just to count them. This RPC
computes `item_count` and `bought_count` server-side with SQL `COUNT ... FILTER`, returning one aggregated
row per list — no item rows transferred to the client.

**Function:** `get_shopping_lists_with_counts(p_trip_id UUID)` — SECURITY DEFINER, checks membership,
returns `shopping_lists` columns + `item_count BIGINT` + `bought_count BIGINT`.

---

## 2026-05-11 — Phase 2: Trips, Members, Invites

### Migration: `create_trips_members_invites`

Created three interdependent tables in a single migration (RLS policies cross-reference each other):

**Tables:**
- `public.trips` — Core trip entity with soft delete, date validation, status lifecycle
- `public.trip_members` — Membership join table with role enforcement (organizer/participant/guest)
- `public.invite_tokens` — Secure invite system with expiry, revocation, and usage limits

**RLS Policies:**
- `trips`: SELECT by members only (soft-deleted hidden), INSERT by any auth user, UPDATE by organizers only
- `trip_members`: SELECT by co-members, INSERT by self or organizer, UPDATE by organizer, DELETE by self or organizer
- `invite_tokens`: SELECT/INSERT/UPDATE by organizers only

**Triggers:**
- `on_trip_created` — auto-inserts trip creator as `organizer` in `trip_members`

**Functions:**
- `redeem_invite_token(token_value TEXT) RETURNS UUID` — SECURITY DEFINER function that validates token (not expired/revoked/over limit), atomically increments `use_count`, inserts user as `participant` or `guest` based on `users.is_guest`, returns `trip_id`. Uses `FOR UPDATE` row lock to prevent race conditions.

**Local migration file:** `supabase/migrations/20260511000002_create_trips_members_invites.sql`

---

## 2026-05-11 — Phase 2: Prevent Last Organizer Removal

### Migration: `prevent_last_organizer_removal`

Added two BEFORE triggers to prevent orphaning a trip without an organizer:

**Triggers:**
- `on_trip_member_delete` — BEFORE DELETE on `trip_members`: raises exception if the member being removed is the last organizer
- `on_trip_member_role_change` — BEFORE UPDATE OF role on `trip_members`: raises exception if demoting the last organizer

Both functions use `SECURITY DEFINER SET search_path = ''`.

**Local migration file:** `supabase/migrations/20260511000003_prevent_last_organizer_removal.sql`

---

## 2026-05-11 — Phase 2: Invite Rate Limiting & Tighten Self-Insert

### Migration: `invite_rate_limit_and_tighten_self_insert`

**Rate limiting:**
- Added `check_invite_rate_limit()` BEFORE INSERT trigger on `invite_tokens`
- Limits organizers to max 10 invite tokens per trip per hour
- Uses `SECURITY DEFINER SET search_path = ''`

**Tightened trip_members INSERT policy:**
- Dropped the permissive `trip_members_insert` policy (which allowed any authenticated user to insert themselves)
- Replaced with `trip_members_insert_organizer_or_system` — only organizers can directly insert members
- SECURITY DEFINER functions (`handle_new_trip`, `redeem_invite_token`) bypass RLS, so auto-insert on trip creation and invite redemption still work

**Local migration file:** `supabase/migrations/20260511000004_invite_rate_limit_and_tighten_self_insert.sql`

---

## 2026-05-12 — Fix: Infinite recursion in trip_members RLS policies

### Problem
Creating a trip (or any query touching `trips`, `trip_members`, or `invite_tokens`) failed with:
`infinite recursion detected in policy for relation "trip_members"`

### Root Cause
The `trip_members_select` RLS policy queried `trip_members` from within its own `USING` clause, creating infinite recursion. Every other policy on `trips` and `invite_tokens` that referenced `trip_members` cascaded into the same loop.

### Fix
1. Created `private` schema (not exposed via Data API) with `GRANT USAGE` to `authenticated`.
2. Created two SECURITY DEFINER helper functions:
   - `private.is_trip_member(p_trip_id UUID, p_user_id UUID)` — checks membership, bypasses RLS
   - `private.is_trip_organizer(p_trip_id UUID, p_user_id UUID)` — checks organizer role, bypasses RLS
3. Rewrote all 10 affected policies across `trips`, `trip_members`, and `invite_tokens` to call these helpers instead of querying `trip_members` directly.
4. Added `created_by = auth.uid()` fallback to `trips_select_member` SELECT policy — in PostgreSQL 17, `RETURNING` is subject to SELECT policies, but the AFTER INSERT trigger (`handle_new_trip`) fires after `RETURNING` evaluates, so `is_trip_member()` would fail for newly created trips. The `created_by` check lets the creator see the row immediately.

**Local migration file:** `supabase/migrations/20260512000001_fix_rls_infinite_recursion.sql`

---

## 2026-05-11 — Fix: Backfill public.users and harden trigger

### Problem
Google sign-in and magic link auth worked (rows created in `auth.users`), but no corresponding rows appeared in `public.users`. Users were authenticated but had no profile data.

### Root Cause
The migration `20260511000001_create_users_table.sql` (which creates `public.users`, the `handle_new_user()` trigger function, and the `on_auth_user_created` trigger) was applied **after** users had already signed up. The trigger only fires on `INSERT` into `auth.users`, so existing users were never backfilled.

### Changes Applied via MCP

**1. Backfilled existing auth.users into public.users**
```sql
INSERT INTO public.users (id, name, email, avatar_url, is_guest)
SELECT
  au.id,
  COALESCE(
    au.raw_user_meta_data ->> 'full_name',
    au.raw_user_meta_data ->> 'name',
    CASE WHEN au.is_anonymous THEN 'Guest' ELSE 'User' END
  ),
  au.email,
  au.raw_user_meta_data ->> 'avatar_url',
  COALESCE(au.is_anonymous, FALSE)
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;
```

**2. Updated `handle_new_user()` trigger function with ON CONFLICT**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url, is_guest)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      CASE WHEN NEW.is_anonymous THEN 'Guest' ELSE 'User' END
    ),
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(NEW.is_anonymous, FALSE)
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, public.users.name),
    email = COALESCE(EXCLUDED.email, public.users.email),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url);
  RETURN NEW;
END;
$$;
```

### Related Code Changes
- `packages/api/src/users.ts` — Added `ensureUserProfile(session)` client-side fallback
- `packages/api/src/index.ts` — Exported `ensureUserProfile`
- `apps/mobile/src/features/auth/hooks/useAuthInit.ts` — Replaced `getUserProfile` with `ensureUserProfile`
- `supabase/migrations/20260511000001_create_users_table.sql` — Updated trigger function with `ON CONFLICT`

---

## 2026-05-11 — Config: Custom SMTP via Resend

### Problem
Supabase's built-in SMTP has a rate limit of ~2 emails/hour and poor deliverability. Magic link emails were not being delivered reliably.

### Solution
Configured [Resend](https://resend.com) as a custom SMTP provider in Supabase Dashboard > Authentication > SMTP Settings.

### SMTP Configuration
| Setting       | Value                              |
|---------------|------------------------------------|
| Host          | `smtp.resend.com`                  |
| Port          | `465`                              |
| Username      | `resend`                           |
| Password      | Resend API key (stored in Dashboard) |
| Sender email  | `onboarding@resend.dev` (free tier) |
| Rate limit    | 30 emails/hour (up from 2)         |

### Known Limitation
Resend's free tier without a verified custom domain only allows sending emails to the Resend account owner's email address (`tdkiodok@gmail.com`). Sending to any other address returns:

```
550 You can only send testing emails to your own email address (tdkiodok@gmail.com).
To send emails to other recipients, please verify a domain at resend.com/domains.
```

**To resolve:** Verify a custom domain at [resend.com/domains](https://resend.com/domains), then update the sender email in Supabase SMTP settings to use that domain (e.g. `noreply@yourdomain.com`).

### Redirect URLs Configured
Added to Supabase Dashboard > Authentication > URL Configuration:
- `vacationist://` — production deep link scheme
- `exp://192.168.x.x:8081` — Expo dev server (local development)

---

## 2026-05-12 — Fix: Soft-delete trip RLS violation

### Problem
Calling `softDeleteTrip` failed with:
`42501: new row violates row-level security policy for table "trips"`

### Root Cause
PostgreSQL 16+ applies **SELECT policies as implicit WITH CHECK constraints on UPDATE**. The `trips_update_organizer` UPDATE policy's own `WITH CHECK` passed (organizer check → true), but PostgreSQL additionally requires the new row to satisfy the SELECT policy `trips_select_member`. That policy requires `deleted_at IS NULL`. After setting `deleted_at`, the new row fails this check — PostgreSQL rejects the UPDATE even though the organizer is authorized.

### Fix
Created `public.soft_delete_trip(p_trip_id UUID)` as a `SECURITY DEFINER` function. It bypasses RLS (runs as function owner), performs its own auth check (`auth.uid()` not null + `private.is_trip_organizer`), and then does the UPDATE directly.

Updated `packages/api/src/trips.ts` → `softDeleteTrip` now calls `supabase.rpc('soft_delete_trip', { p_trip_id })` instead of a direct UPDATE.

**Local migration file:** `supabase/migrations/20260512185430_fix_soft_delete_trip.sql`

---

## 2026-05-12 — Phase 3: Activities & Voting System

### Migration: `create_activities_and_votes`

**Tables:**
- `public.activities` — Activity planning per trip with soft delete, status lifecycle, voting flag
- `public.activity_votes` — Non-numeric voting (must_do/like/open/skip/group_blocker), UNIQUE on (activity_id, user_id) for upsert semantics

**RLS Policies:**
- `activities`: SELECT by trip members (non-deleted), INSERT by trip members (created_by = self), UPDATE by organizer or creator
- `activity_votes`: SELECT by trip members, INSERT/UPDATE/DELETE by own user + voting must be open

**Triggers:**
- `activities_updated_at` — auto-updates `updated_at` on UPDATE (reuses `set_updated_at()`)
- `on_activity_vote_inserted` — AFTER INSERT/UPDATE: auto-finalizes voting when all trip members have voted (sets `voting_open = FALSE`)

**Functions:**
- `public.soft_delete_activity(p_activity_id UUID)` — SECURITY DEFINER: organizer can delete any, participant can delete own, guest cannot delete
- `public.close_activity_voting(p_activity_id UUID)` — SECURITY DEFINER: only organizers can manually close voting

**Indexes:**
- `idx_activities_trip_id` (partial: deleted_at IS NULL)
- `idx_activities_created_by`
- `idx_activities_activity_date` (partial: deleted_at IS NULL)
- `idx_activity_votes_activity_id`
- `idx_activity_votes_user_id`

**Local migration file:** `supabase/migrations/20260512200000_create_activities_and_votes.sql`

---

## 2026-05-12 — Security: Restrict activity update fields

### Migration: `restrict_activity_update_fields`

Added `BEFORE UPDATE` trigger on `activities` that prevents non-organizers from modifying `voting_open` or `status` columns. Also prevents any user from changing `trip_id` or `created_by`.

**Why needed:** The `activities_update_member` RLS policy allows the activity creator (any role) to UPDATE the row. Without this trigger, a participant-creator could bypass the `close_activity_voting` RPC and directly set `voting_open = FALSE` or change status.

**Local migration file:** `supabase/migrations/20260512200001_restrict_activity_update_fields.sql`

---

## 2026-05-12 — Security: Enforce https:// URLs at DB level

### Migration: `enforce_https_urls`

Added CHECK constraints on `activities.external_url` and `activities.maps_url` requiring `https://` prefix. Prevents injection of `javascript:`, `data:`, or other unsafe URL schemes by clients bypassing Zod validation.

**Local migration file:** `supabase/migrations/20260512200002_enforce_https_urls.sql`

---

## 2026-05-12 — Enforce activity_date within trip date range

### Migration: `enforce_activity_date_within_trip`

Added BEFORE INSERT/UPDATE trigger on `activities` that validates `activity_date` falls between the parent trip's `start_date` and `end_date`. NULL `activity_date` is allowed (activity without a set date).

**Why needed:** Client-side Zod validation enforces the date range in `CreateActivitySheet`, but a direct API call could bypass it. The trigger provides defense in depth at the database level.

**Function:** `public.check_activity_date_within_trip()` — SECURITY DEFINER, looks up trip dates and raises exception if out of range.

**Local migration file:** `supabase/migrations/20260512220744_enforce_activity_date_within_trip.sql`

---

## 2026-05-12 — Extend soft_delete_trip to revoke invite tokens

### Change
Updated `public.soft_delete_trip(p_trip_id)` to also revoke all active invite tokens for the trip when it is soft-deleted.

**Why needed:** `invite_tokens.trip_id` has `ON DELETE CASCADE`, but that only fires on hard deletes. Since we never hard-delete trips, a soft-deleted trip's invite tokens would otherwise remain active and redeemable (though `redeem_invite_token` would fail at runtime because the user can't be added to a deleted trip, it is cleaner to revoke tokens explicitly).

**Change:** Added a second `UPDATE public.invite_tokens SET revoked_at = NOW() WHERE trip_id = p_trip_id AND revoked_at IS NULL;` inside the function body, executed after the trip soft-delete.

**Local migration file:** `supabase/migrations/20260512192444_revoke_tokens_on_trip_soft_delete.sql`

---

## 2026-05-13 — Phase 4a: Accommodations & Voting System

### Migration: `create_accommodations_and_votes`

**Tables:**
- `public.accommodations` — Accommodation suggestions per trip with soft delete, status lifecycle (suggested/requested/reserved/booked/completed), voting flag
- `public.accommodation_votes` — Non-numeric voting (must_do/like/open/skip/group_blocker), UNIQUE on (accommodation_id, user_id) for upsert semantics

**RLS Policies:**
- `accommodations`: SELECT by trip members (non-deleted), INSERT by trip members (created_by = self), UPDATE by organizer or creator
- `accommodation_votes`: SELECT by trip members, INSERT/UPDATE/DELETE by own user + voting must be open

**Triggers:**
- `accommodations_updated_at` — auto-updates `updated_at` on UPDATE
- `on_accommodation_update_restrict` — prevents non-organizers from modifying `voting_open` or `status`; prevents anyone from changing `trip_id` or `created_by`
- `on_accommodation_vote_inserted` — AFTER INSERT/UPDATE: auto-finalizes voting when all trip members have voted

**Functions:**
- `public.soft_delete_accommodation(p_accommodation_id UUID)` — SECURITY DEFINER: organizer can delete any, participant can delete own, guest cannot delete
- `public.close_accommodation_voting(p_accommodation_id UUID)` — SECURITY DEFINER: only organizers can manually close voting

**Constraints:**
- `accommodations_external_url_https` — CHECK constraint enforcing `https://` prefix on external URLs

**Indexes:**
- `idx_accommodations_trip_id` (partial: deleted_at IS NULL)
- `idx_accommodations_created_by`
- `idx_accommodation_votes_accommodation_id`
- `idx_accommodation_votes_user_id`

**Local migration file:** `supabase/migrations/20260513100000_create_accommodations_and_votes.sql`

---

## 2026-05-13 — Phase 4b: Expenses & Expense Splits

### Migration: `create_expenses_and_splits`

**Tables:**
- `public.expenses` — Shared cost tracking per trip with archive semantics (`archived_at`), related entity linking, currency enforcement (EUR/CHF)
- `public.expense_splits` — Per-member split amounts with settlement status tracking, UNIQUE on (expense_id, user_id)

**RLS Policies:**
- `expenses`: SELECT by trip members (non-archived), INSERT by trip members (created_by = self), UPDATE by organizer or creator
- `expense_splits`: SELECT by trip members via expense join, INSERT by expense creator or organizer

**Triggers:**
- `expenses_updated_at` — auto-updates `updated_at` on UPDATE
- `on_expense_update_restrict` — prevents changing `trip_id` or `created_by`

**Functions:**
- `public.archive_expense(p_expense_id UUID)` — SECURITY DEFINER: organizer can archive any, creator can archive own
- `public.settle_expense_split(p_split_id UUID)` — SECURITY DEFINER: payer, split owner, or organizer can mark as settled
- `public.unsettle_expense_split(p_split_id UUID)` — SECURITY DEFINER: same permissions, marks split back to open

**Indexes:**
- `idx_expenses_trip_id` (partial: archived_at IS NULL)
- `idx_expenses_paid_by`
- `idx_expenses_created_by`
- `idx_expense_splits_expense_id`
- `idx_expense_splits_user_id`
- `idx_expense_splits_status` (partial: status = 'open')

**Local migration file:** `supabase/migrations/20260513100001_create_expenses_and_splits.sql`

---

## 2026-05-13 — Atomic expense creation RPC

### Migration: `atomic_create_expense`

Replaced the two-step client-side expense+splits creation with a single SECURITY DEFINER RPC that inserts both atomically. Prevents orphaned expenses if split insertion fails.

**Function:**
- `public.create_expense_with_splits(p_trip_id, p_title, p_amount, p_currency, p_paid_by, p_related_type, p_related_id, p_split_user_ids UUID[]) RETURNS UUID` — validates auth + trip membership, inserts expense, calculates even splits with rounding correction on last member, inserts all splits, returns expense ID.

**Local migration file:** `supabase/migrations/20260513200000_atomic_create_expense.sql`

---

## 2026-05-13 — Fix: accommodation_votes UPDATE policy missing trip membership

### Migration: `fix_accommodation_votes_update_policy`

The `accommodation_votes_update_own` UPDATE policy's USING clause only checked `user_id = auth.uid()` but did not verify trip membership. A user removed from a trip could still update their existing vote. Fixed by adding `private.is_trip_member(a.trip_id, auth.uid())` to the USING clause.

**Local migration file:** `supabase/migrations/20260513200001_fix_accommodation_votes_update_policy.sql`

---

## 2026-05-13 — Fix: Auto-finalize accommodation voting blocked by restrict trigger

### Problem
When a non-organizer cast the last vote on an accommodation, the `auto_finalize_accommodation_voting` AFTER INSERT trigger attempted to set `voting_open = FALSE`. This fired the `restrict_accommodation_update_fields` BEFORE UPDATE trigger, which checked `private.is_trip_organizer(auth.uid())` — still the non-organizer — and raised `"Only organizers can change voting_open"`.

### Fix
Same pattern as the activity auto-finalize fix (`20260513000001`): added `pg_trigger_depth() > 1` early return to `restrict_accommodation_update_fields()`. When the update originates from a nested trigger (the auto-finalize function), permission checks are skipped. Direct client UPDATEs (depth = 1) still go through full validation.

**Local migration file:** `supabase/migrations/20260513200002_fix_accommodation_auto_finalize_permissions.sql`

---

## 2026-05-13 — Auto-settle expenses when all splits are settled

### Migration: `auto_settle_expense`

**Schema change:**
- Added `settled_at TIMESTAMPTZ DEFAULT NULL` to `public.expenses`

**Trigger:**
- `on_expense_split_status_change` — AFTER UPDATE OF status on `expense_splits`: when all splits for an expense are settled, sets `expenses.settled_at = NOW()`. When any split is reopened, clears `settled_at = NULL`.

**Function:**
- `public.auto_settle_expense()` — SECURITY DEFINER, counts total vs settled splits and toggles `settled_at` accordingly. Only writes when the value actually changes (avoids unnecessary updates).

**Local migration file:** `supabase/migrations/20260513200003_auto_settle_expense.sql`

---

## 2026-05-13 — Fix: Auto-settle payer's own split on expense creation

### Problem
When an expense was created, all splits (including the payer's) started as `status = 'open'`. The payer's split showing as unsettled made no sense — they already paid. This also caused the settlement badge to show "1/2" instead of "0/1" (the payer's split was counted as an ower).

### Fix
1. Updated `create_expense_with_splits()` to insert the payer's split with `status = 'settled'` automatically. If every split member is the payer (edge case), also sets `expenses.settled_at = NOW()` immediately.
2. Backfilled all existing payer splits to `status = 'settled'`.
3. Backfilled `expenses.settled_at` for any expenses where all splits are now settled.

### Related Code Changes
- `ExpenseCard` settlement badge now counts only ower splits (excludes payer's split) for the `X/Y` display.
- Expenses tab uses `SectionList` with "Active" and "Completed" sections based on `settled_at`.

**Local migration file:** `supabase/migrations/20260513200004_auto_settle_payer_split.sql`

---

## 2026-05-13 — Fix: Allow SELECT on archived expenses and splits

### Migrations: `allow_select_archived_expenses` & `allow_select_archived_expense_splits`

Updated RLS policies to allow trip members to SELECT archived expenses and their splits. Previously the partial index and SELECT policies filtered out `archived_at IS NOT NULL` rows, preventing the UI from showing them in the Archived section.

**Local migration files:**
- `supabase/migrations/20260513200005_allow_select_archived_expenses.sql`
- `supabase/migrations/20260513200006_allow_select_archived_expense_splits.sql`

---

## 2026-05-13 — Splitwise-like expense enhancements (flexible splits, editing, balances)

### Migration: `expense_split_methods`

**Schema changes:**
- Added `split_method TEXT NOT NULL DEFAULT 'even' CHECK (split_method IN ('even', 'exact', 'shares'))` to `public.expenses`
- Added `shares INT` column to `public.expense_splits` (used for shares-based splitting)

**Local migration file:** `supabase/migrations/20260513300000_expense_split_methods.sql`

---

### Migration: `flexible_expense_splits`

**Function (CREATE OR REPLACE):**
- `public.create_expense_with_splits(...)` — new overload accepting `p_split_method TEXT` and `p_splits JSONB` (array of `{user_id, amount?, shares?}`) instead of `p_split_user_ids UUID[]`
  - `even`: server-side calculated equal splits with rounding correction
  - `exact`: uses provided amounts per split, validates sum equals total
  - `shares`: uses provided integer shares to compute proportional amounts
  - Payer's split auto-settled; all-payer edge case sets `settled_at` immediately

**Local migration file:** `supabase/migrations/20260513300001_flexible_expense_splits.sql`

---

### Migration: `update_expense_with_splits`

**Function (new):**
- `public.update_expense_with_splits(p_expense_id UUID, p_title TEXT, p_amount NUMERIC, p_paid_by UUID, p_split_method TEXT, p_splits JSONB) RETURNS VOID` — SECURITY DEFINER
  - Validates auth: organizer or expense creator
  - Updates expense row (title, amount, paid_by, split_method)
  - Deletes existing splits and re-inserts new ones
  - Payer's split auto-settled, others reset to 'open'
  - Clears `settled_at` (re-evaluated by trigger)

**Local migration file:** `supabase/migrations/20260513300002_update_expense_with_splits.sql`

---

### Migration: `trip_balances`

**Function (new):**
- `public.get_trip_balances(p_trip_id UUID) RETURNS TABLE(user_id UUID, total_paid NUMERIC, total_owed NUMERIC, net_balance NUMERIC)` — SECURITY DEFINER
  - Computes per-member balances across non-archived expenses
  - `total_paid`: sum of `expenses.amount` where `paid_by = user_id`
  - `total_owed`: sum of `expense_splits.amount_owed` where `split.user_id = user_id`
  - `net_balance`: `total_paid - total_owed` (positive = others owe them)

**Local migration file:** `supabase/migrations/20260513300003_trip_balances.sql`

---

## 2026-05-14 — Expense System Architecture Hardening

### Migration: `20260514000001_expense_schema_hardening.sql`
- **Dropped** `expense_splits.shares` column (input mechanics only, not business truth)
- **Dropped** `expenses.settled_at` column + `auto_settle_expense()` trigger (settlement now derived from splits)
- **Added** `expenses.updated_by UUID REFERENCES users(id)` for edit audit trail

### Migration: `20260514000002_update_expense_rpcs.sql`
- **Dropped** dead UUID[] overload of `create_expense_with_splits`
- **Updated** `create_expense_with_splits` (JSONB): removed shares persistence, removed settled_at logic
- **Updated** `update_expense_with_splits`: removed shares persistence, removed settled_at logic, added `updated_by = auth.uid()`
- **Updated** `get_trip_balances`: added ROUND to 2 decimal places, zeroes net_balance below 0.01 threshold

### Migration: `20260514000003_expense_security_hardening.sql`
- **Updated** `create_expense_with_splits`: validates `paid_by` is a trip member, validates all split `user_id`s are trip members, caps splits at 50
- **Updated** `update_expense_with_splits`: same three security validations as create

### Migration: `20260514000004_settlement_aware_balances.sql`
- **Updated** `get_trip_balances`: settlement-aware balance computation
  - Added `settled_by_ower` CTE: credits owers who have settled their splits (+amount)
  - Added `settled_to_payer` CTE: debits payers who received settlements (-amount)
  - New formula: `net_balance = total_paid + settled_back - total_owed - received_settlements`
  - Zeroes net_balance where `ABS(net_balance) < 0.01` (residual threshold)

---

## 2026-05-14 — Phase 5a: Shopping Lists & Items

### Migration: `20260514100000_create_shopping_lists_and_items.sql`

**Tables:**
- `public.shopping_lists` — shopping lists per trip
- `public.shopping_items` — items within a shopping list with soft delete, position ordering, V1 statuses (open/bought)

**RLS Policies:**
- `shopping_lists`: SELECT by trip members, INSERT by trip members (created_by = self), UPDATE by organizer or list creator
- `shopping_items`: SELECT by trip members (non-deleted, via list → trip), INSERT by trip members, UPDATE by any trip member (status changes)

**Triggers:**
- `shopping_lists_updated_at` / `shopping_items_updated_at` — auto-updates `updated_at`
- `on_shopping_item_update_restrict` — prevents guests from changing title/quantity/unit/notes; prevents anyone from changing shopping_list_id/created_by

**Functions:**
- `public.soft_delete_shopping_item(p_item_id UUID)` — SECURITY DEFINER: organizer can delete any, participant can delete own, guest cannot delete
- `public.delete_shopping_list(p_list_id UUID)` — SECURITY DEFINER: organizer or list creator can hard-delete (cascades items)

**Indexes:**
- `idx_shopping_lists_trip_id` on `shopping_lists(trip_id)`
- `idx_shopping_items_list_id` on `shopping_items(shopping_list_id)` WHERE `deleted_at IS NULL`
- `idx_shopping_items_status` on `shopping_items(status)` WHERE `deleted_at IS NULL`

**Supabase Realtime:**
- `shopping_items` table added to `supabase_realtime` publication for live item status updates

**Local migration file:** `supabase/migrations/20260514100000_create_shopping_lists_and_items.sql`

### Migration: `20260514120000_add_shopping_list_archived_at.sql`

Adds `archived_at TIMESTAMPTZ DEFAULT NULL` column to `shopping_lists` for section grouping (Active / Completed / Archived). Existing UPDATE RLS policy already covers organizer/creator access.

**Local migration file:** `supabase/migrations/20260514120000_add_shopping_list_archived_at.sql`

### Migration: `20260514130000_reopen_voting_functions.sql`

Adds SECURITY DEFINER functions for re-opening voting on activities and accommodations (organizer only):
- `public.reopen_activity_voting(p_activity_id UUID)` — sets `voting_open = TRUE`
- `public.reopen_accommodation_voting(p_accommodation_id UUID)` — sets `voting_open = TRUE`

Both functions check authentication, entity existence, and organizer role.

**Local migration file:** `supabase/migrations/20260514130000_reopen_voting_functions.sql`

---

## 2026-05-18 — Phase 5b: Realtime Voting for Activities & Accommodations

### Migration: `20260518000001_add_voting_realtime_publication.sql`

Added vote tables and entity tables to Supabase Realtime publication for live vote updates across all trip members.

**Realtime publication additions:**
- `public.activity_votes` — live vote INSERT/UPDATE/DELETE events
- `public.accommodation_votes` — live vote INSERT/UPDATE/DELETE events
- `public.activities` — live entity UPDATE events (voting_open status changes, edits)
- `public.accommodations` — live entity UPDATE events (voting_open status changes, edits)

**REPLICA IDENTITY changes:**
- `public.activity_votes` → FULL (DELETE payloads include all columns, needed to identify which activity a deleted vote belonged to)
- `public.accommodation_votes` → FULL (same reason)

**Architecture:**
- One realtime channel per trip per feature (`activity-voting:{tripId}`, `accommodation-voting:{tripId}`)
- Each channel listens to both vote events (unfiltered, since vote tables lack `trip_id`) and entity UPDATE events (filtered by `trip_id`)
- Realtime callbacks update TanStack Query cache directly, following the same pattern as Phase 5a shopping items
- App foreground resume triggers resubscription + query invalidation for reconciliation

**Local migration file:** `supabase/migrations/20260518000001_add_voting_realtime_publication.sql`

---

## 2026-05-19 — Phase 5c: Realtime Expenses

### Migration: `20260519000001_add_expenses_realtime_publication.sql`

Added expense tables to Supabase Realtime publication for live expense updates across all trip members.

**Realtime publication additions:**
- `public.expenses` — live INSERT/UPDATE events (create, edit, archive)
- `public.expense_splits` — live INSERT/UPDATE/DELETE events (create, settle/unsettle, cascade from update RPC)

**REPLICA IDENTITY changes:**
- `public.expense_splits` → FULL (DELETE payloads include all columns, needed because `update_expense_with_splits` DELETEs and recreates splits — `expense_id` is needed for client-side trip filtering)

**Architecture:**
- One realtime channel per trip: `expenses:{tripId}:{uid}`
- `expenses` events use server-side filter `trip_id=eq.{tripId}`
- `expense_splits` events are unfiltered (no `trip_id` column) — client-side guard checks `expense_id` against cached trip expenses
- Uses **debounced invalidation** (300ms) instead of surgical `setQueryData` because RPCs produce event bursts (e.g., `update_expense_with_splits` fires 1 UPDATE + N DELETEs + N INSERTs)
- Invalidates `['trips', tripId, 'expenses']`, `['trips', tripId, 'balances']`, and specific `['expenses', expenseId, 'splits']`
- Follows voting-style Pattern B: exponential backoff, status callbacks, AppState foreground resubscription

**Local migration file:** `supabase/migrations/20260519000001_add_expenses_realtime_publication.sql`

---

## 2026-05-19 — Phase 6: Recipes & Ingredients

### Migration: `20260519100000_create_recipes_and_ingredients.sql`

**Tables:**
- `public.recipes` — Recipe management per trip (hard delete), with title, description, servings
- `public.recipe_ingredients` — Ingredients per recipe (hard delete via CASCADE), with quantity, unit, sort_order

**RLS Policies:**
- `recipes`: SELECT by trip members, INSERT by trip members (created_by = self), UPDATE by organizer or creator
- `recipe_ingredients`: SELECT/INSERT by trip members (via recipes join), UPDATE/DELETE by organizer or recipe creator

**Triggers:**
- `recipes_updated_at` — auto-updates `updated_at` on UPDATE (reuses `set_updated_at()`)
- `on_recipe_update_restrict` — prevents guests from editing recipes; prevents anyone from changing `trip_id` or `created_by`

**Functions:**
- `public.delete_recipe(p_recipe_id UUID)` — SECURITY DEFINER: organizer or recipe creator can hard-delete (cascades ingredients)

**FK Constraints:**
- `fk_shopping_items_source_recipe` on `shopping_items.source_recipe_id` → `recipes(id) ON DELETE SET NULL`
- `fk_shopping_items_source_ingredient` on `shopping_items.source_ingredient_id` → `recipe_ingredients(id) ON DELETE SET NULL`

**Columns added to shopping_items:**
- `source_ingredient_id UUID DEFAULT NULL` — tracks which recipe ingredient each shopping item was created from. Enables auto-propagation of ingredient add/update/delete to linked shopping lists. Only set on directly-created items (not merged duplicates).

**Indexes:**
- `idx_recipes_trip_id` on `recipes(trip_id)`
- `idx_recipe_ingredients_recipe_id` on `recipe_ingredients(recipe_id)`
- `idx_shopping_items_source_ingredient_id` on `shopping_items(source_ingredient_id) WHERE source_ingredient_id IS NOT NULL`

**Supabase Realtime:**
- `recipes` table added to `supabase_realtime` publication for live recipe CRUD updates
- `recipe_ingredients` table added to `supabase_realtime` publication for live ingredient changes (migration: `20260520100000_enable_realtime_recipe_ingredients.sql`)

**Functions:**
- `get_recipe_linked_lists(p_recipe_id UUID) RETURNS TABLE(shopping_list_id UUID)` — SECURITY DEFINER function that returns all distinct shopping list IDs a recipe has been added to, including lists where all items have been soft-deleted. Bypasses RLS to see soft-deleted rows that the SELECT policy would otherwise hide.

**Local migration files:**
- `supabase/migrations/20260519100000_create_recipes_and_ingredients.sql`
- `supabase/migrations/20260520100000_enable_realtime_recipe_ingredients.sql`
- `supabase/migrations/20260520110000_add_source_ingredient_id_to_shopping_items.sql`
- `supabase/migrations/20260520120000_fix_shopping_items_update_rls_for_soft_delete.sql` — removed `deleted_at IS NULL` from `WITH CHECK` clause of `shopping_items_update_member` policy so that direct soft-deletes via UPDATE work (needed for recipe ingredient propagation)
- `supabase/migrations/20260520130000_add_get_recipe_linked_lists_fn.sql` — SECURITY DEFINER function to find linked shopping lists even when all items are soft-deleted

---

## 2026-05-21 — Phase 7b: Prework Preferences

### Migration: `20260521000001_create_prework_preferences.sql`

Per-member preference filters for accommodation search prework. Each trip member distributes up to 100 credits across free-text filters (e.g., "Pool", "Near beach", "Kitchen") to guide the organizer's external accommodation search.

**Table:**
- `public.prework_preferences` — One row per member per trip. Filters stored as JSONB array `[{ "label": "Pool", "weight": 40 }, ...]`. UNIQUE constraint on `(trip_id, user_id)` enables upsert semantics.

**Columns:**
- `id` UUID PK
- `trip_id` UUID NOT NULL → `trips(id) ON DELETE CASCADE`
- `user_id` UUID NOT NULL → `users(id) ON DELETE CASCADE`
- `filters` JSONB NOT NULL DEFAULT `'[]'` with CHECK `jsonb_typeof(filters) = 'array'`
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

**RLS Policies:**
- `prework_preferences_select_member` — SELECT: any trip member can see all preferences for their trip
- `prework_preferences_insert_member` — INSERT: trip members can insert their own row only (`user_id = auth.uid()`)
- `prework_preferences_update_own` — UPDATE: own row only
- `prework_preferences_delete_own` — DELETE: own row only

**Triggers:**
- `prework_preferences_updated_at` — BEFORE UPDATE: reuses existing `set_updated_at()`

**Indexes:**
- `idx_prework_preferences_trip_id` on `prework_preferences(trip_id)`

**Design decisions:**
- JSONB single-row-per-member pattern avoids cross-row sum constraints — 100-credit max enforced at app level via Zod
- No status/voting columns — this is a lightweight input-gathering feature, not a voting system
- All members can see all preferences (no privacy restrictions)

**Local migration file:** `supabase/migrations/20260521000001_create_prework_preferences.sql`

### Migration: `20260521000002_enable_prework_realtime.sql`

Added `prework_preferences` table to Supabase Realtime publication for live preference updates across trip members.

**Realtime publication additions:**
- `public.prework_preferences` — live INSERT/UPDATE/DELETE events

**Architecture:**
- One realtime channel per trip: `prework:{tripId}`
- Server-side filter on `trip_id=eq.{tripId}`
- Client uses `setQueryData` for surgical cache updates on INSERT/UPDATE/DELETE
- Follows existing realtime pattern: exponential backoff reconnection [2s, 5s, 10s, 30s], AppState foreground resubscription + query invalidation

**Local migration file:** `supabase/migrations/20260521000002_enable_prework_realtime.sql`

---

## 2026-05-22 — Phase 7c: Transfer (Flights, Vehicles, Rental Cars)

### Migration: `20260522000001_create_transfer_flights_and_votes`

**Tables:**
- `public.transfer_flights` — Flight options per trip with soft delete, direction (outbound/return), airline info, departure/arrival airports + times, price per person, post-booking fields (flight_number, booking_reference), status lifecycle (suggested/booked/completed), voting flag
- `public.transfer_flight_votes` — Non-numeric voting (must_do/like/open/skip/group_blocker), UNIQUE on (flight_id, user_id) for upsert semantics

**RLS Policies:**
- `transfer_flights`: SELECT by trip members (non-deleted), INSERT by trip members (created_by = self), UPDATE by organizer any or creator own
- `transfer_flight_votes`: SELECT by trip members, INSERT/UPDATE/DELETE by own user + voting must be open; own-update policy also checks trip membership

**Triggers:**
- `transfer_flights_updated_at` — auto-updates `updated_at` on UPDATE
- `restrict_transfer_flight_update_fields` — BEFORE UPDATE: prevents changing trip_id/created_by; restricts voting_open, status, flight_number, booking_reference changes to organizers only; skips check when called from nested trigger (pg_trigger_depth > 1)
- `auto_finalize_transfer_flight_voting` — AFTER INSERT/UPDATE on transfer_flight_votes: SECURITY DEFINER, sets voting_open=FALSE when all trip members have voted

**Functions:**
- `public.soft_delete_transfer_flight(p_flight_id UUID)` — SECURITY DEFINER: organizer any, participant own, guest cannot
- `public.close_transfer_flight_voting(p_flight_id UUID)` — SECURITY DEFINER: organizer only
- `public.reopen_transfer_flight_voting(p_flight_id UUID)` — SECURITY DEFINER: organizer only
- `public.book_transfer_flight(p_flight_id UUID, p_flight_number TEXT DEFAULT NULL, p_booking_reference TEXT DEFAULT NULL)` — SECURITY DEFINER: organizer only, atomically sets status='booked' + voting_open=FALSE

**Constraints:**
- `transfer_flights_external_url_https` — CHECK enforcing `https://` prefix on external URLs

**Indexes:**
- `idx_transfer_flights_trip_id` (partial: deleted_at IS NULL)
- `idx_transfer_flights_created_by`
- `idx_transfer_flight_votes_flight_id`
- `idx_transfer_flight_votes_user_id`

**Local migration file:** `supabase/migrations/20260522000001_create_transfer_flights_and_votes.sql`

---

### Migration: `20260522000002_create_transfer_flight_passengers`

**Table:**
- `public.transfer_flight_passengers` — Passengers assigned to a booked flight. UNIQUE on (flight_id, user_id).

**RLS Policies:**
- SELECT: trip members (via flight → trip join)
- INSERT/DELETE: organizer only

**Triggers:**
- `verify_flight_booked_before_passenger` — BEFORE INSERT: raises exception if the flight's status is not 'booked'

**Functions:**
- `public.set_transfer_flight_passengers(p_flight_id UUID, p_user_ids UUID[])` — SECURITY DEFINER: organizer only, atomically replaces entire passenger list (DELETE all + INSERT new) in a single transaction

**Indexes:**
- `idx_transfer_flight_passengers_flight_id`

**Local migration file:** `supabase/migrations/20260522000002_create_transfer_flight_passengers.sql`

---

### Migration: `20260522000003_create_transfer_vehicles_and_passengers`

**Tables:**
- `public.transfer_vehicles` — Personal vehicles per trip with soft delete and direction (outbound/return)
- `public.transfer_vehicle_passengers` — Members in each vehicle with an `is_driver` flag. UNIQUE on (vehicle_id, user_id).

**RLS Policies:**
- `transfer_vehicles`: SELECT by trip members (non-deleted), INSERT by trip members, UPDATE by organizer or creator
- `transfer_vehicle_passengers`: SELECT by trip members (via vehicle → trip join), INSERT/UPDATE/DELETE by organizer or vehicle creator

**Triggers:**
- `transfer_vehicles_updated_at` — auto-updates `updated_at` on UPDATE

**Functions:**
- `public.soft_delete_transfer_vehicle(p_vehicle_id UUID)` — SECURITY DEFINER: organizer any, participant own, guest cannot

**Indexes:**
- `idx_transfer_vehicles_trip_id` (partial: deleted_at IS NULL)
- `idx_transfer_vehicles_created_by`
- `idx_transfer_vehicle_passengers_vehicle_id`

**Local migration file:** `supabase/migrations/20260522000003_create_transfer_vehicles_and_passengers.sql`

---

### Migration: `20260522000004_create_transfer_rentals`

**Table:**
- `public.transfer_rentals` — Rental car bookings per trip with soft delete. No voting, no passengers. Fields: company, pickup/dropoff locations, pickup/dropoff dates, booking_reference, price_total, external_url (HTTPS-only), notes.

**RLS Policies:**
- SELECT: trip members (non-deleted)
- INSERT: trip members (created_by = self)
- UPDATE: organizer or creator

**Triggers:**
- `transfer_rentals_updated_at` — auto-updates `updated_at` on UPDATE

**Functions:**
- `public.soft_delete_transfer_rental(p_rental_id UUID)` — SECURITY DEFINER: organizer any, participant own, guest cannot

**Constraints:**
- `transfer_rentals_external_url_https` — CHECK enforcing `https://` prefix on external URLs

**Indexes:**
- `idx_transfer_rentals_trip_id` (partial: deleted_at IS NULL)
- `idx_transfer_rentals_created_by`

**Local migration file:** `supabase/migrations/20260522000004_create_transfer_rentals.sql`

---

### Migration: `20260522000005_enable_transfer_realtime`

Added all six transfer tables to Supabase Realtime publication and configured REPLICA IDENTITY for junction tables.

**Realtime publication additions:**
- `public.transfer_flights` — live INSERT/UPDATE events
- `public.transfer_flight_votes` — live INSERT/UPDATE/DELETE events
- `public.transfer_flight_passengers` — live INSERT/DELETE events
- `public.transfer_vehicles` — live INSERT/UPDATE events
- `public.transfer_vehicle_passengers` — live INSERT/UPDATE/DELETE events
- `public.transfer_rentals` — live INSERT/UPDATE events

**REPLICA IDENTITY changes:**
- `public.transfer_flight_votes` → FULL (DELETE payloads include all columns to identify the flight a vote belonged to)
- `public.transfer_flight_passengers` → FULL (DELETE payloads include all columns)
- `public.transfer_vehicle_passengers` → FULL (DELETE payloads include all columns)

**Architecture:**
- One channel per trip per category: `transfer-flights:{tripId}:{uid}`, `transfer-vehicles:{tripId}:{uid}`, `transfer-rentals:{tripId}:{uid}`
- Flight channel subscribes to vote, flight update, and passenger change events
- Vehicle channel subscribes to vehicle and vehicle-passenger change events
- All channels use exponential backoff reconnection and AppState foreground resubscription

**Local migration file:** `supabase/migrations/20260522000005_enable_transfer_realtime.sql`

---

### Migration: `20260522000006_transfer_outbound_return`

Extended `transfer_flights` to support round-trip tickets stored as a single entry.

**Schema changes:**
- `transfer_flights.direction` CHECK constraint extended to accept `'outbound-return'` (was `'outbound' | 'return'`)
- Added four return-leg columns (all nullable, only used when `direction = 'outbound-return'`):
  - `return_departure_airport TEXT` CHECK `char_length <= 100`
  - `return_arrival_airport TEXT` CHECK `char_length <= 100`
  - `return_departure_time TIMESTAMPTZ`
  - `return_arrival_time TIMESTAMPTZ`
- `REPLICA IDENTITY FULL` applied to `transfer_flights` so realtime INSERT events carry the full row payload

**Why REPLICA IDENTITY FULL:** The flight INSERT realtime handler was added to ensure other users see new flights without a manual refresh. Full replica identity guarantees the complete row is available in the INSERT payload.

**Local migration file:** `supabase/migrations/20260522000006_transfer_outbound_return.sql`

---

## 2026-05-22 — Transfer: Vehicle outbound-return + Realtime REPLICA IDENTITY

### Migration: `20260522000007_vehicle_outbound_return_and_replica_identity`

**Changes:**
- `transfer_vehicles.direction` CHECK constraint extended to allow `'outbound-return'` (was only `'outbound' | 'return'`)
- `REPLICA IDENTITY FULL` applied to `transfer_vehicles` — ensures the `trip_id` filter on realtime UPDATE events (soft-delete) works reliably for all subscribers
- `REPLICA IDENTITY FULL` applied to `transfer_rentals` — same reason

**Why REPLICA IDENTITY FULL on vehicles and rentals:** Without it, UPDATE payloads in Supabase realtime only include changed columns. The `trip_id` filter on the subscription would not match because `trip_id` is not present in the old/new diff. Setting FULL replica identity guarantees all columns are available in every UPDATE payload, enabling correct filter evaluation and soft-delete propagation to all users.

**Local migration file:** `supabase/migrations/20260522000007_vehicle_outbound_return_and_replica_identity.sql`

---

## 2026-05-25 — Phase 7d: Profile Settings — Encrypted Travel Documents & Organizer Access

### Migration: `20260525000001_enable_pgcrypto_and_vault_secret`

Bootstraps the encryption layer for travel document PII fields.

**Extensions:**
- `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions` — provides `pgp_sym_encrypt` / `pgp_sym_decrypt` / `gen_random_bytes`
- `CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault` — secure key storage

**Vault secret:**
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'travel_documents_encryption_key') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'travel_documents_encryption_key',
      'AES-256 key for encrypting travel document PII fields'
    );
  END IF;
END $$;
```
**IMPORTANT:** Use `vault.create_secret()` (SECURITY DEFINER function), NOT `INSERT INTO vault.secrets` directly. Direct INSERT triggers `_crypto_aead_det_noncegen`, which requires pgsodium internals unavailable to the migrator role and produces `permission denied for function _crypto_aead_det_noncegen`.

**Private helper:**
- `private.get_travel_doc_encryption_key() RETURNS TEXT` — SECURITY DEFINER, reads from `vault.decrypted_secrets`. Isolates vault access to a single trusted function; SECURITY DEFINER RPCs call this helper, PostgREST API cannot reach it.

**Local migration file:** `supabase/migrations/20260525000001_enable_pgcrypto_and_vault_secret.sql`

---

### Migration: `20260525000002_create_user_travel_documents`

Creates the encrypted travel document store.

**Table `user_travel_documents`:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK→users | CASCADE |
| `document_type` | TEXT | CHECK ('passport', 'id_card') |
| `full_legal_name` | BYTEA | AES-256 encrypted |
| `document_number` | BYTEA | AES-256 encrypted |
| `date_of_birth` | BYTEA | AES-256 encrypted |
| `nationality` | TEXT | plaintext ISO alpha-2 |
| `issuing_country` | TEXT | plaintext ISO alpha-2 |
| `expiry_date` | DATE | plaintext (for reminder logic) |
| `notes` | BYTEA | AES-256 encrypted |
| `created_at`, `updated_at` | TIMESTAMPTZ | `set_updated_at()` trigger |
| UNIQUE(user_id, document_type) | | one per type per user |

**RLS:** Enabled. SELECT restricted to `user_id = auth.uid()`. INSERT/UPDATE/DELETE policies deny all (`WITH CHECK (false)`) — forces all writes through SECURITY DEFINER RPCs.

**RPCs (all SECURITY DEFINER, `SET search_path = ''`):**
- `upsert_travel_document(p_document_type, p_full_legal_name, p_document_number, p_date_of_birth, p_nationality, p_issuing_country, p_expiry_date, p_notes)` — encrypts sensitive fields, upserts on `(user_id, document_type)` conflict
- `get_my_travel_documents()` — returns decrypted rows for `auth.uid()` only
- `delete_travel_document(p_document_id)` — deletes own document by id

**Local migration file:** `supabase/migrations/20260525000002_create_user_travel_documents.sql`

---

### Migration: `20260525000003_create_document_access_system`

Creates the time-limited access request and grant system.

**Table `document_access_requests`:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `trip_id` | UUID FK→trips | CASCADE |
| `requested_by` | UUID FK→users | CASCADE |
| `duration_minutes` | INT | CHECK (15, 30, 60) |
| `created_at` | TIMESTAMPTZ | |

**Table `document_access_grants`:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `request_id` | UUID FK→document_access_requests | CASCADE |
| `user_id` | UUID FK→users | CASCADE |
| `granted` | BOOLEAN | |
| `expires_at` | TIMESTAMPTZ | set when granted=true |
| `responded_at` | TIMESTAMPTZ | |
| UNIQUE(request_id, user_id) | | one response per member |

**RLS:** Requests visible to trip members. Grants visible to own user + the organizer who made the request. No direct writes (RPCs only).

**RPCs:**
- `create_document_access_request(p_trip_id, p_duration_minutes)` — organizer only, rate-limited to 1 active request per trip per 24h
- `respond_to_document_access_request(p_request_id, p_granted)` — member only (not the requester), sets `expires_at = NOW() + duration` if granted
- `get_my_pending_access_requests()` — returns unresponded requests for current user, with trip title + requester info
- `get_accessible_member_documents(p_trip_id)` — organizer only, returns decrypted docs for members with active non-expired grants

**Local migration file:** `supabase/migrations/20260525000003_create_document_access_system.sql`

---

### Migration: `20260525000004_profile_settings_security_fixes`

Security hardening migration applying all CRITICAL and HIGH fixes found during security review.

**New table `document_access_audit_log`:**
- Records every `get_accessible_member_documents` call (organizer, member, timestamp)
- RLS: organizer sees their own entries; member sees entries where their docs were accessed
- No direct INSERT (populated only by the SECURITY DEFINER RPC)

**Updated RPC `upsert_travel_document`:**
- Added `trim()` on all text inputs
- ISO alpha-2 regex validation: `^[A-Z]{2}$` on `nationality` and `issuing_country`
- Date format regex: `^\d{4}-\d{2}-\d{2}$` on `date_of_birth`

**Updated RPC `create_document_access_request`:**
- Rate limit tightened from per-organizer-per-trip to per-trip (any organizer)

**Updated RPC `respond_to_document_access_request`:**
- TOCTOU mitigation: rejects requests older than 24 hours (`created_at < NOW() - INTERVAL '24 hours'`)

**Updated RPC `get_accessible_member_documents`:**
- Inserts into `document_access_audit_log` before returning documents

**New RPC `revoke_document_access(p_request_id UUID)`:**
- Allows a member to revoke their own grant: sets `granted=false, expires_at=NULL`

**New RPC `get_my_active_grants()`:**
- Returns grants where `granted=true AND expires_at > NOW()` for caller, with trip title + requester info

**Local migration file:** `supabase/migrations/20260525000004_profile_settings_security_fixes.sql`

---

### Security Architecture Summary (4-Layer Model)

| Layer | Mechanism | What It Protects Against |
|-------|-----------|--------------------------|
| **Database** | pgcrypto AES-256 column encryption + Vault key + SECURITY DEFINER RPCs (no direct table access) | DB breach, stolen backups, direct SQL access |
| **Network** | HTTPS/TLS (Supabase default) | MITM, eavesdropping |
| **Application** | TanStack Query `staleTime: 0` + `gcTime: 0`, no local caching | Device theft, memory inspection |
| **UX** | Biometric/PIN gate (`expo-local-authentication`), masked doc numbers, 30s auto-hide, AppState lock | Shoulder surfing, unlocked device |

---

## 2026-05-26 — Bug fixes: notifications realtime, trip ordering, effective status

### Migration: `20260526000001_scaling_indexes`

Performance improvements for vote rate-limit and nudge rate-limit queries.

**Indexes added:**
- `idx_activity_votes_rate_limit ON activity_votes(user_id, trip_id, created_at DESC)` — turns O(trip_votes) scan into O(1) range scan for `check_vote_rate_limit`
- `idx_accommodation_votes_rate_limit ON accommodation_votes(user_id, trip_id, created_at DESC)`
- `idx_transfer_flight_votes_rate_limit ON transfer_flight_votes(user_id, trip_id, created_at DESC)`
- `idx_notifications_nudge_rate_limit ON notifications(trip_id, created_at DESC) WHERE type = 'reminder'` — partial index for `send_organizer_nudge` rate-limit COUNT

**Function updated:**
- `public.check_vote_rate_limit()` — rewrote 3 sequential `COUNT(*)` calls to a single `COUNT(*) FROM (... UNION ALL ...)` to share one execution plan and short-circuit at the 60-vote limit

---

### Migration: `20260526000002_batch_push_dispatch`

Rewrote push notification dispatch from O(M) vault reads + HTTP calls to O(1) per event.

**Problem:** `private.create_trip_notification` looped over M trip members, and each `notifications` INSERT fired the per-row `trg_dispatch_push_notification` trigger — 2 vault reads + 1 `net.http_post` per row. A 9-member trip triggered 18 blocking vault reads and 9 Edge Function invocations per activity creation.

**Fix:**
- `private.dispatch_push_notification()` updated: returns immediately when `current_setting('app.batch_push_pending', true) = 'true'`
- `private.create_trip_notification()` rewritten: sets the transaction-local flag before the loop, collects `(user_id, notification_id)` pairs, resets the flag after the loop, then reads vault once and calls `net.http_post` once with `batch=true` + UUID arrays

**Edge Function** (`push-notification/index.ts`) already handles the `batch: true` payload — one preference/token query + one Expo API call for all recipients.

---

### Migration: `20260526000003_denormalize_trip_member_count`

Denormalized `member_count` onto `trips` to eliminate the per-row subquery in `getTrips()`.

**Schema change:**
- Added `member_count INTEGER NOT NULL DEFAULT 0` to `public.trips`
- Backfilled from `COUNT(*) per trip_id` in `trip_members`

**Trigger:** `trg_maintain_trip_member_count` (AFTER INSERT OR DELETE on `trip_members`) — `private.maintain_trip_member_count()` SECURITY DEFINER; increments on INSERT, decrements on DELETE (floor at 0)

---

### Migration: `20260526000004_enable_notifications_realtime`

Root cause fix for notifications not updating in real time.

**Problem:** The `notifications` table was never added to the `supabase_realtime` publication. `useNotificationsRealtime` subscribed to `postgres_changes` on `notifications` but received no events — new notifications only appeared after a manual pull-to-refresh.

**Changes:**
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications`
- `ALTER TABLE public.notifications REPLICA IDENTITY FULL` — required so DELETE events include all columns (enabling the `user_id=eq.{userId}` filter) and UPDATE events include old values

### Code changes (2026-05-26 bug fixes)

**`packages/api/src/trips.ts`:**
- `getTrips()` sort order changed from `ascending: false` to `ascending: true` — trips now display earliest start date first

**`apps/mobile/src/features/trips/components/TripCard.tsx`:**
- Added `getEffectiveStatus(trip: Trip): TripStatus` — returns `'completed'` for any trip whose `end_date` is in the past (unless already `'archived'` or `'completed'` in DB); returns `'active'` for ongoing trips; falls back to DB status otherwise
- `<StatusBadge>` now receives `getEffectiveStatus(trip)` instead of `trip.status`

**`apps/mobile/src/features/notifications/hooks/useNotifications.ts`:**
- `useNotifications`: added `refetchInterval: 30_000` (30 s polling fallback)
- `useNotificationsRealtime` `onInsert`: added `queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })` and trip-scoped unread count invalidation — badge now updates immediately when a new notification arrives
- `useNotificationsRealtime` `onUpdate`: added same unread count invalidations — badge updates when a notification is marked read on another device

**`apps/mobile/src/features/notifications/hooks/useUnreadCount.ts`:**
- `useUnreadCount`: added `refetchInterval: 30_000`
- `useTripUnreadCount`: added `refetchInterval: 30_000`

---

## 2026-05-22 — Transfer: Fix soft-delete realtime propagation (RLS)

### Migration: `20260522000008_transfer_realtime_softdelete_rls`

**Problem:** After a soft-delete UPDATE, the updated row has `deleted_at IS NOT NULL`. The previous SELECT RLS policy required `deleted_at IS NULL`, so Supabase realtime dropped the UPDATE event for other subscribers — they never saw the deletion. Adding `REPLICA IDENTITY FULL` was necessary but not sufficient; the RLS gate was still blocking delivery.

**Fix:**
- Removed `deleted_at IS NULL` from the SELECT RLS policies on `transfer_flights`, `transfer_vehicles`, and `transfer_rentals`
- Added explicit `.is('deleted_at', null)` filters to `getTransferFlights`, `getTransferVehicles`, and `getTransferRentals` in the API layer, so deleted items still don't appear in regular queries
- Now the post-soft-delete row passes RLS (trip member check only), Supabase realtime delivers the UPDATE event, and the client-side `onUpdate` handler removes the item from the cache

**Local migration file:** `supabase/migrations/20260522000008_transfer_realtime_softdelete_rls.sql`

---

## 2026-05-26 — Avatars storage bucket

### Migration: `20260526175044_create_avatars_bucket`

**Purpose:** Adds the `avatars` Supabase Storage bucket for user profile pictures, wired up with RLS.

**Storage bucket:**
- Name: `avatars`, public, 5 MB file size limit, MIME types restricted to `image/*`

**RLS policies:**
- `avatars_select` — public SELECT (anyone can read avatar URLs)
- `avatars_insert` — authenticated users can INSERT into their own `{userId}/` folder
- `avatars_update` — authenticated users can UPDATE objects in their own `{userId}/` folder
- `avatars_delete` — authenticated users can DELETE objects in their own `{userId}/` folder

**Upload path convention:** `${userId}/avatar` (no file extension). Fixed path means each upload overwrites the same Storage object — no stale files accumulate when image format changes between uploads.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260526175044_create_avatars_bucket.sql`

---

## 2026-05-26 — Activity creation RPC (SETOF → UUID return type fix)

### Migration: `20260526180000_create_activity_rpc`

**Purpose:** Replaced the direct `INSERT INTO activities` (which required the caller to hold an authenticated session via RLS) with a `SECURITY DEFINER` RPC, fixing activity creation failures on the Android Preview build against prod Supabase.

**Root cause of original failure:** RLS `WITH CHECK` on `public.activities` evaluated the full AND of all conditions; the session was present but `is_trip_member` returned false for the prod environment under the Android client's auth token delivery timing. The SECURITY DEFINER RPC bypasses RLS entirely and runs the member check internally.

**Function:** `public.create_activity(p_trip_id, p_title, p_description, p_category, p_cost_estimate, p_activity_date, p_start_time, p_end_time, p_external_url, p_maps_url)` — original version returned `SETOF public.activities`.

**Local migration file:** `supabase/migrations/20260526180000_create_activity_rpc.sql`

---

### Migration: `20260526190000_fix_create_activity_return_type`

**Purpose:** Changed `create_activity` return type from `SETOF public.activities` to `RETURNS UUID`. The SETOF version worked on Web but caused a silent runtime failure on Android React Native — the fetch polyfill did not parse the SETOF JSON array the same way, so `(data as Activity[])?.[0]` returned `undefined`.

**Fix pattern:** Matches `upsert_travel_document` — RPC returns the new row's UUID, caller then fetches the full row with `getActivity(id)`.

**Migration approach:** `DROP FUNCTION` before `CREATE FUNCTION` — PostgreSQL forbids changing return type via `CREATE OR REPLACE`.

**TypeScript side (`packages/api/src/activities.ts`):** `createActivity` now calls `supabase.rpc('create_activity', {...})` for the UUID, then `getActivity(activityId)` to return the full `Activity` object.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260526190000_fix_create_activity_return_type.sql`

---

## 2026-05-27 — Bug fix: push notifications not delivered for event-triggered notifications

### Migration: `20260527000001_fix_push_dispatch_polling`

**Problem:** Push notifications for `new_activity`, `new_expense`, `new_member`, `vote_finalized`, and `schedule_change` were never delivered to devices. Organizer nudges (type `reminder`) worked correctly.

**Root cause:** `private.create_trip_notification()` calls `net.http_post()` at `pg_trigger_depth() >= 1` — it is invoked from within AFTER INSERT/UPDATE triggers on `activities`, `expenses`, `trip_members`, etc. Supabase's pg_net silently drops HTTP jobs queued from inside a trigger stack. Confirmed by `SELECT * FROM net.http_request_queue` returning 0 rows immediately after activity creation. Nudges worked because `send_organizer_nudge` is a plain RPC (depth 0) — `net.http_post()` ran at depth 0 and queued correctly.

**Fix:**

1. `private.create_trip_notification()` rewritten to detect `pg_trigger_depth() >= 1`. When inside a trigger, the function still INSERTs all notification rows but skips the `net.http_post()` call. At depth 0 (nudge RPC), behavior is unchanged — one immediate batch HTTP call.

2. New `private.dispatch_pending_push_notifications()` SECURITY DEFINER function: queries `notifications WHERE push_sent_at IS NULL AND (push_queued_at IS NULL OR push_queued_at < NOW() - INTERVAL '5 minutes')`, stamps `push_queued_at = NOW()` per row to prevent duplicate dispatch within the retry window, then calls `net.http_post()` once per notification in single-mode payload. Always called at depth 0 by pg_cron, so pg_net queues correctly.

3. `pg_cron` job `dispatch-pending-push-notifications` scheduled `* * * * *` (every minute) to drive the polling function.

4. `push_queued_at TIMESTAMPTZ` column added to `notifications` — prevents re-queueing the same notification on consecutive cron ticks while the Edge Function is processing. `restrict_notification_update_fields` trigger updated to guard this column (only writeable by service role / SECURITY DEFINER, not authenticated users).

5. Partial index `idx_notifications_push_pending ON notifications(created_at ASC) WHERE push_sent_at IS NULL` — makes the polling SELECT fast.

**Latency impact:**
- Nudges: unchanged (immediate, depth-0 batch HTTP call)
- All event notifications: up to ~60 s (next cron tick)

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260527000001_fix_push_dispatch_polling.sql`

---

## 2026-05-27 — Bug fix: missing notification event triggers on prod

### Migration: `20260527000002_fix_missing_event_notification_triggers_prod`

**Problem:** All event-driven notification triggers were absent from prod. Creating an activity, expense, or new member on prod produced no rows in `public.notifications` even though the `create_trip_notification` function and migration history entry existed.

**Root cause:** Migration `20260522213024` was applied to prod before the `CREATE TRIGGER` statements were added to the file (migration drift). The function definitions were present but none of the six triggers were ever created on prod. Only `trg_notify_document_access_request` (from a later migration `20260525000007`) existed.

**Missing triggers restored:**
| Trigger | Table | Event |
|---|---|---|
| `trg_notify_new_activity` | `activities` | AFTER INSERT |
| `trg_notify_new_expense` | `expenses` | AFTER INSERT |
| `trg_notify_new_member` | `trip_members` | AFTER INSERT |
| `trg_notify_activity_vote_finalized` | `activities` | AFTER UPDATE |
| `trg_notify_accommodation_vote_finalized` | `accommodations` | AFTER UPDATE |
| `trg_notify_schedule_change` | `activities` | AFTER UPDATE |

**Migration is idempotent:** uses `DROP TRIGGER IF EXISTS` before each `CREATE TRIGGER` — no-op drops on dev (triggers already existed), clean creates on prod.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260527000002_fix_missing_event_notification_triggers_prod.sql`

---

## 2026-05-27 — Bug fix: check_vote_rate_limit functional drift on prod

### Migration: `20260527000003_fix_check_vote_rate_limit_prod`

**Problem:** `public.check_vote_rate_limit()` on prod was an older version missing two correctness improvements present on dev.

**Missing improvements:**

1. **False-positive rate limiting on UPDATE:** Prod counted UPDATE operations toward the 60-votes/hour quota even when `NEW.vote = OLD.vote` (no-op update). Dev added an early return: `IF TG_OP = 'UPDATE' AND NEW.vote = OLD.vote THEN RETURN NEW; END IF;`

2. **Stale time window for updated votes:** Prod used `created_at` only when counting recent votes, so a vote updated multiple times in the same hour was counted only once. Dev uses `GREATEST(created_at, updated_at)` so each vote change within the hour is counted.

**Root cause:** Same migration drift pattern — the function body was improved on dev after the originating migration had already been applied to prod. The `schema_migrations` version list showed parity; only a full function-body comparison revealed the difference.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260527000003_fix_check_vote_rate_limit_prod.sql`

---

## 2026-05-11 — Phase 1: Users Table

### Migration: `20260511000001_create_users_table`

**Why:** Extends Supabase `auth.users` with app-specific profile data (name, avatar, locale, timezone, guest flag). Auto-creates a profile row on every new auth sign-up.

**Table created:** `public.users`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | FK → `auth.users(id)` CASCADE |
| `name` | TEXT | |
| `email` | TEXT UNIQUE nullable | |
| `avatar_url` | TEXT nullable | |
| `locale` | TEXT | `DEFAULT 'de-DE'` (see later locale migrations) |
| `timezone` | TEXT | `DEFAULT 'Europe/Berlin'` |
| `is_guest` | BOOLEAN | `DEFAULT FALSE` |
| `created_at` | TIMESTAMPTZ | `DEFAULT NOW()` |

**RLS:**
- SELECT: any `authenticated` user (needed for trip member display)
- UPDATE: own row only (`auth.uid() = id`)
- INSERT: own row only (`auth.uid() = id`)

**Trigger:**
- `on_auth_user_created` AFTER INSERT on `auth.users` → `public.handle_new_user()` SECURITY DEFINER — upserts a profile row using `raw_user_meta_data` (full_name/name/avatar_url/is_anonymous).

**Local migration file:** `supabase/migrations/20260511000001_create_users_table.sql`

---

## 2026-05-12 — Fix: redeem_invite_token missing used_at

### Migration: `20260512000002_fix_redeem_invite_token_used_at`

**Problem:** `redeem_invite_token` incremented `use_count` but never set `used_at`, so the column stayed NULL even after successful redemptions.

**Fix:** Updated the `UPDATE invite_tokens SET ...` statement to also set `used_at = NOW()`.

**Local migration file:** `supabase/migrations/20260512000002_fix_redeem_invite_token_used_at.sql`

---

## 2026-05-12 — Add updated_at to core tables

### Migration: `20260512180319_add_updated_at`

**Why:** `public.users`, `public.trips`, and `public.invite_tokens` were missing `updated_at` columns. Also introduces the shared `public.set_updated_at()` trigger function reused across all tables.

**Changes:**
- `ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `ALTER TABLE public.trips ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `ALTER TABLE public.invite_tokens ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Created `public.set_updated_at()` RETURNS TRIGGER — sets `NEW.updated_at = NOW()`
- Created `users_updated_at`, `trips_updated_at`, `invite_tokens_updated_at` BEFORE UPDATE triggers

**Local migration file:** `supabase/migrations/20260512180319_add_updated_at.sql`

---

## 2026-05-13 — Fix: auto-finalize activity voting blocked by permission trigger

### Migration: `20260513000001_fix_auto_finalize_voting_permissions`

**Problem:** When a non-organizer cast the last vote on an activity, the `auto_finalize_activity_voting` AFTER INSERT trigger tried to set `voting_open = FALSE`. This fired `check_activity_update_permissions`, which blocked non-organizers from changing `voting_open`.

**Fix:** Added `pg_trigger_depth() > 1` early return to `check_activity_update_permissions()`. Nested trigger updates skip the organizer check; direct client UPDATEs (depth = 1) still get full validation.

**Local migration file:** `supabase/migrations/20260513000001_fix_auto_finalize_voting_permissions.sql`

---

## 2026-05-19 — Unarchive expense

### Migration: `20260519000002_unarchive_expense`

**Why:** Organizers and expense creators need to restore accidentally archived expenses.

**Function:**
- `public.unarchive_expense(p_expense_id UUID)` — SECURITY DEFINER; validates auth, checks `archived_at IS NOT NULL`, verifies caller is organizer or creator, sets `archived_at = NULL`.

**Local migration file:** `supabase/migrations/20260519000002_unarchive_expense.sql`

---

## 2026-05-23 — Fix: trip_id nullable for trigger-populated columns

### Migration: `20260523000002_trip_id_nullable_for_trigger_insert`

**Why:** After `20260523000001` added denormalized `trip_id NOT NULL` columns to 7 child tables, Supabase's generated TypeScript Insert types required callers to supply `trip_id` even though the BEFORE INSERT trigger always populates it. Making the column nullable removes that false requirement from generated types — data integrity is still enforced by the trigger.

**Tables modified:** `activity_votes`, `accommodation_votes`, `transfer_flight_votes`, `transfer_flight_passengers`, `transfer_vehicle_passengers`, `expense_splits`, `shopping_items` — `trip_id` column changed from `NOT NULL` to nullable.

**Local migration file:** `supabase/migrations/20260523000002_trip_id_nullable_for_trigger_insert.sql`

---

## 2026-05-23 — Phase 9 Security: Vote rate limiting

### Migration: `20260523120000_vote_rate_limit`

**Why:** Prevents automated vote spam. Limits to max 60 votes per user per trip per hour, aggregated across all three vote tables.

**Function:** `public.check_vote_rate_limit()` — SECURITY DEFINER; counts rows in `activity_votes`, `accommodation_votes`, `transfer_flight_votes` for the caller in the last hour; raises exception if ≥ 60.

**Triggers (BEFORE INSERT):**
- `on_activity_vote_rate_limit` on `activity_votes`
- `on_accommodation_vote_rate_limit` on `accommodation_votes`
- `on_transfer_flight_vote_rate_limit` on `transfer_flight_votes`

**Note:** This initial version was later hardened by `20260523200051` (UPDATE support, ex-member RLS fix) and again by `20260526000001` (index optimization) and `20260527000003` (prod drift fix).

**Local migration file:** `supabase/migrations/20260523120000_vote_rate_limit.sql`

---

## 2026-05-23 — Security hardening batch

### Migration: `20260523195339_fix_is_guest_self_elevation`

**Problem:** The `users_update_own` RLS policy allowed users to UPDATE any column, including `is_guest`. A guest user could set `is_guest = false` to elevate their own privileges.

**Fix:** Added BEFORE UPDATE trigger `trg_restrict_user_self_update` → `public.restrict_user_self_update()` SECURITY DEFINER — raises exception if `NEW.is_guest IS DISTINCT FROM OLD.is_guest`.

**Local migration file:** `supabase/migrations/20260523195339_fix_is_guest_self_elevation.sql`

---

### Migration: `20260523195712_fix_expense_guest_bypass`

**Problem:** `archive_expense` and `unarchive_expense` both allow the expense creator to act, but guests should have read-only access. A guest who created an expense could archive/unarchive it.

**Fix:** Both functions updated with an explicit `IF v_role = 'guest' THEN RAISE EXCEPTION` check before the creator check.

**Local migration file:** `supabase/migrations/20260523195712_fix_expense_guest_bypass.sql`

---

### Migration: `20260523195815_fix_nudge_rate_limit`

**Problem:** The nudge rate limit counted individual `notifications` rows (N rows per nudge for N−1 members). A trip with 4+ members could only send 1 nudge before the 3-row threshold was hit.

**Fix:** Each nudge now generates a shared `related_id = gen_random_uuid()` stored on all its notification rows. The rate limit counts `COUNT(DISTINCT related_id)` instead of raw rows. Also added input length guards: title ≤ 100 chars, body ≤ 300 chars.

**Index update:** `idx_notifications_nudge_rate_limit` rebuilt as `(trip_id, related_id, created_at DESC) WHERE type = 'reminder' AND related_type = 'nudge'` for efficient distinct-count queries.

**Local migration file:** `supabase/migrations/20260523195815_fix_nudge_rate_limit.sql`

---

### Migration: `20260523195846_fix_expense_splits_direct_insert`

**Problem:** The `expense_splits_insert_creator` RLS policy allowed direct INSERT into `expense_splits`, bypassing trip-member validation enforced inside the RPCs. A caller could insert splits with arbitrary non-member `user_id`s.

**Fix:** Replaced the policy with `expense_splits_insert_rpc_only` — `WITH CHECK (false)`. All writes must go through the SECURITY DEFINER RPCs (`create_expense_with_splits`, `update_expense_with_splits`) which validate every split `user_id` against trip membership.

**Local migration file:** `supabase/migrations/20260523195846_fix_expense_splits_direct_insert.sql`

---

### Migration: `20260523200051_fix_vote_rate_limit_and_rls`

**Two findings fixed:**

**Finding 5 — Rate limit bypassed via UPDATE:** The original rate limit only fired on INSERT. A user could cycle a vote value via UPDATE repeatedly without hitting the cap. Fix:
- Added `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` to `activity_votes`, `accommodation_votes`, `transfer_flight_votes`
- Added `stamp_vote_updated_at()` BEFORE UPDATE triggers on all three tables
- Rewrote `check_vote_rate_limit()`: no-op return when `TG_OP = 'UPDATE' AND NEW.vote = OLD.vote`; counts via `GREATEST(created_at, updated_at)` so each change cycle is counted
- Extended rate-limit triggers to fire on INSERT OR UPDATE

**Finding 6 — Ex-member vote update:** `activity_votes` and `transfer_flight_votes` UPDATE USING clause only checked `user_id = auth.uid()`, allowing a removed member to update their lingering vote row. Fix: added `AND private.is_trip_member(trip_id, auth.uid())` to the USING clause on both tables.

**Index updates:** Composite rate-limit indexes rebuilt to include `updated_at DESC`.

**Local migration file:** `supabase/migrations/20260523200051_fix_vote_rate_limit_and_rls.sql`

---

### Migration: `20260523200134_fix_prework_filters_size_cap`

**Problem:** `prework_preferences.filters` only checked `jsonb_typeof(filters) = 'array'` with no element count limit. An attacker could store an unbounded array causing large row sizes and slow reads for all trip members.

**Fix:** Added CHECK constraint `prework_filters_max_elements` capping the array at 20 elements (`jsonb_array_length(filters) <= 20`).

**Local migration file:** `supabase/migrations/20260523200134_fix_prework_filters_size_cap.sql`

---

### Migration: `20260523200233_fix_push_sent_at_user_writable`

**Problem:** `restrict_notification_update_fields` excluded `push_sent_at` from its immutable-field check, meaning authenticated users could write this internal system timestamp directly.

**Fix:** Added a block: `IF NEW.push_sent_at IS DISTINCT FROM OLD.push_sent_at AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION`. Service-role calls (Edge Function) have `auth.uid() = NULL` and are still permitted; authenticated users are blocked.

**Local migration file:** `supabase/migrations/20260523200233_fix_push_sent_at_user_writable.sql`

---

## 2026-05-25 — Fix: document access concurrent guard

### Migration: `20260525000006_fix_document_access_concurrent_guard`

**Why:** The original `create_document_access_request` had a 24-hour per-organizer-per-trip rate limit, which was too coarse. Replaced with a concurrent-request guard: at most **one active request per trip** at any point in time.

**Active request definition:**
- Created within its own `duration_minutes` window (still pending), OR
- At least one grant tied to it is still non-expired (`granted = true AND expires_at > NOW()`)

**Updated RPC:** `public.create_document_access_request(p_trip_id, p_duration_minutes)` — replaced `COUNT` rate-limit check with `EXISTS` check for any active request matching either condition above.

**Local migration file:** `supabase/migrations/20260525000006_fix_document_access_concurrent_guard.sql`

---

## 2026-05-25 — Document access request notification trigger

### Migration: `20260525000007_notify_document_access_request_trigger`

**Why:** Separated from `20260522213024_create_notification_event_triggers` because `document_access_requests` is created in a later migration (`20260525000003`). The trigger must be created after the table exists.

**Trigger function:** `private.notify_document_access_request()` SECURITY DEFINER — on AFTER INSERT on `document_access_requests`, calls `private.create_trip_notification` with type `'document_access_request'`, excluding the requester.

**Trigger:** `trg_notify_document_access_request` (uses `DROP TRIGGER IF EXISTS` for idempotency).

**Local migration file:** `supabase/migrations/20260525000007_notify_document_access_request_trigger.sql`

---

## 2026-05-28 — User locale normalization

### Migration: `20260528000001_constrain_users_locale`

**Why:** The `locale` column defaulted to `'de-DE'` (a BCP-47 locale tag). The app switched to short codes (`'en'`, `'de'`). This migration normalizes existing values and constrains future ones.

**Changes:**
- Backfills: `'de-DE'` → `'de'`; anything else → `'en'`
- Adds CHECK constraint: `locale IN ('en', 'de')`
- Updates default to `'de'`

**Local migration file:** `supabase/migrations/20260528000001_constrain_users_locale.sql`

---

## 2026-05-29 — Make users.locale nullable

### Migration: `20260529000001_make_users_locale_nullable`

**Why:** Newly registered users should get `locale = NULL` ("preference not yet saved") rather than the forced default `'de'`. The app uses the device locale until the user explicitly sets one in Profile Settings.

**Changes:**
- `ALTER TABLE public.users ALTER COLUMN locale DROP DEFAULT`
- `ALTER TABLE public.users ALTER COLUMN locale DROP NOT NULL`

**Note:** The `CHECK (locale IN ('en', 'de'))` constraint from the previous migration still applies; PostgreSQL evaluates CHECK as NULL (passing) for NULL inputs, so NULL is allowed.

**Local migration file:** `supabase/migrations/20260529000001_make_users_locale_nullable.sql`

---

## 2026-05-31 — Cover split method

### Migration: `20260531000001_add_cover_split_method`

**Why:** Adds a `'cover'` split method where the payer covers the full expense for exactly one other person. Useful for "I'll pay for you" scenarios.

**Schema change:** `expenses.split_method` CHECK constraint extended to include `'cover'`.

**Business rules enforced in RPCs:**
- `cover` requires exactly one split entry
- Cannot cover yourself (`split user_id ≠ paid_by`)
- The covered person is the only ower; the full `p_amount` is their `amount_owed`

Both `create_expense_with_splits` and `update_expense_with_splits` updated to handle `'cover'`.

**Local migration file:** `supabase/migrations/20260531000001_add_cover_split_method.sql`

---

### Migration: `20260531000002_fix_cover_rpc`

**Why:** Repair migration ensuring `create_expense_with_splits` and `update_expense_with_splits` function bodies are up to date after the cover method was added (function drift repair).

**Local migration file:** `supabase/migrations/20260531000002_fix_cover_rpc.sql`

---

### Migration: `20260531000003_fix_cover_expense_model`

**Why:** The initial cover model had the wrong direction — `paid_by = Gary, split user = Gabriel` meant Gabriel owed Gary (debt increases). The correct model is: `paid_by = Gabriel` (their `total_paid` increases, reducing their debt), `split user = Gary, status = 'open'` (Gary owes that amount).

**Fix:** For all existing cover expenses: swaps `paid_by` and the split `user_id` and sets split `status = 'open'`.

**Local migration file:** `supabase/migrations/20260531000003_fix_cover_expense_model.sql`

---

### Migration: `20260531000004_cover_split_cascade_settle`

**Why:** Cover splits must settle atomically with their related non-cover splits to prevent balance formula reversion.

**Rules:**
1. Settling a non-cover split auto-settles any linked cover splits (where `cover.paid_by = ower AND cover split consumer = payer`)
2. Unsettling a non-cover split auto-unsettles those cover splits
3. Settling a cover split directly is blocked

Updated `settle_expense_split` and `unsettle_expense_split` with this cascade logic.

**Local migration file:** `supabase/migrations/20260531000004_cover_split_cascade_settle.sql`

---

### Migration: `20260531000005_cover_existing_split`

**Why:** Adds a way to cover an existing split in-place (e.g., "I'll cover your €10 share"). The covered person's split amount becomes 0 (settled as a gift); the covering person's split grows or is inserted.

**Schema changes:**
- `expense_splits.covered_by UUID REFERENCES public.users(id)` — who covered this split
- `expense_splits.original_amount NUMERIC(10,2)` — saved for uncover reversal

**Functions:**
- `public.cover_split(p_split_id UUID)` — SECURITY DEFINER; validates open+uncovered split, zeros covered split with `covered_by/original_amount/status=settled`, increases or inserts covering user's split
- `public.uncover_split(p_split_id UUID)` — SECURITY DEFINER; organizer or `covered_by` only; restores original amount, removes or reduces covering split

**Local migration file:** `supabase/migrations/20260531000005_cover_existing_split.sql`

---

### Migration: `20260531000006_settle_all_for_pair`

**Why:** Powers the "Settle all" button in the Simplified Settlements view — settles every open split for a debtor→creditor pair in a single atomic call.

**Function:** `public.settle_all_for_pair(p_trip_id UUID, p_debtor UUID, p_creditor UUID) RETURNS INT` — SECURITY DEFINER; loops over open non-cover splits where `paid_by = creditor AND user_id = debtor`; includes the same cover-split cascade as `settle_expense_split`; returns count of settled splits.

**Local migration file:** `supabase/migrations/20260531000006_settle_all_for_pair.sql`

---

### Migration: `20260531000007_remove_cover_cascade`

**Why:** The cover-split cascade in `settle_expense_split` and `unsettle_expense_split` matched by pair (any cover between the same two people), not by specific expense. When multiple covers exist between the same pair, the cascade was unreliable. Cover splits are now settled manually (or via `settle_all_for_pair`).

**Fix:** Removed the cascade UPDATE block from both `settle_expense_split` and `unsettle_expense_split`.

**Local migration file:** `supabase/migrations/20260531000007_remove_cover_cascade.sql`

---

## 2026-05-31 — Add reservation_required to activities

### Migration: `20260531000008_add_reservation_required_to_activities`

**Why:** Allows trip members to mark activities that require advance booking.

**Schema change:** `activities.reservation_required BOOLEAN NOT NULL DEFAULT FALSE`

**RPC update:** `create_activity` signature extended with `p_reservation_required BOOLEAN DEFAULT FALSE` parameter. Function was DROPped and recreated (PostgreSQL forbids changing signature via `CREATE OR REPLACE`).

**Local migration file:** `supabase/migrations/20260531000008_add_reservation_required_to_activities.sql`

---

## 2026-05-31 — Add auto_close to voting entities

### Migration: `20260531100000_add_auto_close_to_voting_entities`

**Why:** Previously, voting always closed automatically once all trip members voted. Organizers needed a way to keep voting open for deliberation. `auto_close = FALSE` (the new default) prevents auto-closure; `auto_close = TRUE` preserves the old behavior.

**Schema changes:**
- `activities.auto_close BOOLEAN NOT NULL DEFAULT FALSE`
- `accommodations.auto_close BOOLEAN NOT NULL DEFAULT FALSE`
- `transfer_flights.auto_close BOOLEAN NOT NULL DEFAULT FALSE`

**Functions updated:**
- `auto_finalize_activity_voting()` — returns early if `auto_close = FALSE`
- `auto_finalize_accommodation_voting()` — same
- `auto_finalize_transfer_flight_voting()` — same
- `check_activity_update_permissions()` — extended to guard `auto_close` changes (organizer only)
- `create_activity` RPC — extended with `p_auto_close BOOLEAN DEFAULT FALSE`

**Local migration file:** `supabase/migrations/20260531100000_add_auto_close_to_voting_entities.sql`

---

### Migration: `20260531100001_guard_auto_close_accommodations_flights`

**Why:** `20260531100000` added `auto_close` guard to activities via `check_activity_update_permissions`. Accommodations and transfer flights needed equivalent guards.

**Triggers added:**
- `on_accommodation_auto_close_check` BEFORE UPDATE on `accommodations` → `check_accommodation_auto_close_permissions()` — raises exception if non-organizer changes `auto_close`
- `on_transfer_flight_auto_close_check` BEFORE UPDATE on `transfer_flights` → `check_transfer_flight_auto_close_permissions()` — same

**Local migration file:** `supabase/migrations/20260531100001_guard_auto_close_accommodations_flights.sql`

---

## 2026-05-31 — Add description to prework preferences

### Migration: `20260531110000_add_description_to_prework`

**Why:** Allows users to write a short free-text note at the top of their preference entry (e.g., "The first base is already decided, let's focus on the second one.").

**Schema change:** `prework_preferences.description TEXT NULL`

**Local migration file:** `supabase/migrations/20260531110000_add_description_to_prework.sql`

---

## 2026-06-01 — Stuff Feature: Packing Lists, Shared Packing, Lost & Found

### Migration: `20260601000001_create_stuff_tables`

**Why:** Introduces three new trip-scoped features — private per-user packing lists, shared packing coordination, and a Lost & Found bulletin.

**Tables created:**

**`public.packing_categories`** (seed/reference table)
- `id`, `name`, `icon`, `sort_order`, `is_default`
- RLS: authenticated SELECT only (no writes from clients)
- Seeded with 8 default categories: Clothes, Cosmetics, Documents, Electronics, Outdoor, Medicine, Shared, Other

**`public.packing_items`** (private per-user)
- `id`, `trip_id` (FK → trips CASCADE), `user_id` (FK → users CASCADE), `category TEXT`, `title TEXT`, `is_packed BOOLEAN DEFAULT FALSE`, `notes TEXT nullable`, `sort_order INT DEFAULT 0`, `source_shared_item_id UUID DEFAULT NULL`, `created_at`, `updated_at`, `deleted_at`
- RLS: SELECT own non-deleted rows + trip membership; INSERT own + trip membership; UPDATE own only
- Triggers: `packing_items_updated_at`, `trg_restrict_packing_item_update` (blocks `trip_id`, `user_id`, `created_at` changes)
- Indexes: `idx_packing_items_trip_user`, `idx_packing_items_category`

**`public.shared_packing_items`** (trip-visible)
- `id`, `trip_id`, `title`, `item_type TEXT CHECK ('i_got_it', 'who_has', 'everyone')`, `notes TEXT nullable`, `created_by`, `claimed_by UUID nullable`, `is_resolved BOOLEAN DEFAULT FALSE`, `created_at`, `updated_at`, `deleted_at`
- RLS: SELECT all trip members (non-deleted); INSERT creator + trip member; UPDATE any trip member (for claiming)
- Triggers: `shared_packing_items_updated_at`, `trg_restrict_shared_packing_item_update` (blocks `trip_id`, `created_by`, `item_type` changes)
- Index: `idx_shared_packing_items_trip`

**`public.lost_found_cases`**
- `id`, `trip_id`, `case_type TEXT CHECK ('lost_unknown', 'lost_known', 'found_unknown', 'found_owner_known')`, `title`, `description TEXT nullable`, `created_by`, `target_user UUID nullable`, `is_resolved BOOLEAN DEFAULT FALSE`, `resolved_at TIMESTAMPTZ nullable`, `created_at`, `updated_at`
- RLS: SELECT trip members where `created_by = me OR target_user = me OR target_user IS NULL`; INSERT creator + trip member; UPDATE any trip member
- Triggers: `lost_found_cases_updated_at`, `trg_restrict_lost_found_case_update` (blocks `trip_id`, `created_by`, `case_type` changes)
- Indexes: `idx_lost_found_cases_trip`, `idx_lost_found_cases_target_user` (partial: `is_resolved = FALSE`)

**Local migration file:** `supabase/migrations/20260601000001_create_stuff_tables.sql`

---

### Migration: `20260601000002_stuff_notification_types`

**Why:** Adds notification types and preference columns for the Stuff feature.

**Changes:**
- `notifications.type` CHECK constraint extended with `'lost_found'` and `'shared_packing'`
- `notification_preferences` table: added `lost_found BOOLEAN NOT NULL DEFAULT TRUE`, `shared_packing BOOLEAN NOT NULL DEFAULT TRUE`

**Local migration file:** `supabase/migrations/20260601000002_stuff_notification_types.sql`

---

### Migration: `20260601000003_stuff_rpcs_and_triggers`

**Why:** Business logic RPCs and notification triggers for the Stuff feature.

**Functions:**
- `public.soft_delete_packing_item(p_item_id UUID)` — SECURITY DEFINER; owner only (checks `user_id = caller`)
- `public.soft_delete_shared_packing_item(p_item_id UUID)` — SECURITY DEFINER; organizer or creator
- `public.claim_shared_packing_item(p_item_id UUID)` — SECURITY DEFINER; any trip member; validates `who_has` type + unclaimed; marks `claimed_by/is_resolved`; auto-inserts a packing_item for claimer under "Shared" category
- `public.copy_packing_list_to_trip(p_source_trip_id UUID, p_target_trip_id UUID) RETURNS INT` — SECURITY DEFINER; copies caller's non-deleted packing items from source trip to target (target must be `planning` or `active`)
- `public.resolve_lost_found_case(p_case_id UUID)` — SECURITY DEFINER; any trip member; sets `is_resolved = TRUE, resolved_at = NOW()`
- `public.delete_lost_found_case(p_case_id UUID)` — SECURITY DEFINER; organizer or creator; hard delete

**Triggers:**
- `trg_notify_new_lost_found_case` AFTER INSERT on `lost_found_cases` → `private.notify_new_lost_found_case()`: broadcasts to all members (type `'lost_found'`) if `target_user IS NULL`; notifies only `target_user` otherwise
- `trg_handle_shared_packing_item_insert` AFTER INSERT on `shared_packing_items` → `private.handle_shared_packing_item_insert()`: for `'everyone'` — auto-inserts packing_item for all members + broadcasts notification; for `'i_got_it'` — auto-inserts for creator + notifies others; for `'who_has'` — no auto-insert, no immediate notification
- `trg_notify_shared_packing_item_claimed` AFTER UPDATE on `shared_packing_items` → `private.notify_shared_packing_item_claimed()`: notifies original creator when `claimed_by` changes from NULL to non-NULL

**Local migration file:** `supabase/migrations/20260601000003_stuff_rpcs_and_triggers.sql`

---

### Migration: `20260601000004_packing_items_unique_source`

**Problem:** `ON CONFLICT DO NOTHING` in `handle_shared_packing_item_insert` was a no-op because no unique constraint existed on `(trip_id, user_id, source_shared_item_id)`. Trigger replays or multiple `'everyone'` items could create duplicate packing rows.

**Fix:** Created partial unique index `idx_packing_items_unique_source ON packing_items(trip_id, user_id, source_shared_item_id) WHERE source_shared_item_id IS NOT NULL AND deleted_at IS NULL`.

**Local migration file:** `supabase/migrations/20260601000004_packing_items_unique_source.sql`

---

### Migration: `20260601000005_packing_dynamic_shared_category`

**Problem:** `claim_shared_packing_item` and `handle_shared_packing_item_insert` hardcoded the string `'Shared'` as the category. If the seeded category is renamed, auto-inserted items silently end up under an orphaned category.

**Fix:** Both functions rewritten to look up the category name via `SELECT name FROM packing_categories WHERE is_default = TRUE AND name = 'Shared' LIMIT 1`, falling back to the literal `'Shared'` only if absent.

Also updated `ON CONFLICT` syntax to use the explicit `ON CONFLICT ON CONSTRAINT idx_packing_items_unique_source DO NOTHING`.

**Local migration file:** `supabase/migrations/20260601000005_packing_dynamic_shared_category.sql`

---

### Migration: `20260601000006_fix_packing_conflict_syntax`

**Problem:** `ON CONFLICT ON CONSTRAINT` only works with named constraints created via `ADD CONSTRAINT`. The unique index from `20260601000004` was created via `CREATE UNIQUE INDEX`, not a named constraint, so PostgreSQL rejected the syntax.

**Fix:**
1. Drop and recreate `idx_packing_items_unique_source` without the `deleted_at IS NULL` predicate (simpler partial index)
2. Rewrite both `claim_shared_packing_item` and `handle_shared_packing_item_insert` to use column-based conflict syntax: `ON CONFLICT (trip_id, user_id, source_shared_item_id) WHERE source_shared_item_id IS NOT NULL DO NOTHING`

**Local migration file:** `supabase/migrations/20260601000006_fix_packing_conflict_syntax.sql`

---

### Migration: `20260601000007_unresolve_lost_found`

**Why:** Allows trip members to revert a mistakenly resolved Lost & Found case back to unresolved.

**Function:** `public.unresolve_lost_found_case(p_case_id UUID)` — SECURITY DEFINER; any trip member; sets `is_resolved = FALSE, resolved_at = NULL`.

**Local migration file:** `supabase/migrations/20260601000007_unresolve_lost_found.sql`

---

### Migration: `20260601000008_unclaim_shared_packing`

**Why:** Allows reversing a packing item claim or an `i_got_it` declaration.

**Function:** `public.unclaim_shared_packing_item(p_item_id UUID)` — SECURITY DEFINER
- `i_got_it`: creator only — sets `is_resolved = FALSE` (item goes back to open state)
- `who_has`: claimer or creator — sets `claimed_by = NULL, is_resolved = FALSE`
- `everyone`: blocked (cannot unclaim)

**Local migration file:** `supabase/migrations/20260601000008_unclaim_shared_packing.sql`

---

## 2026-06-02 — App Enhancements: Notifications, Vehicles, Prework

Three purely additive RPCs. No table changes, no data mutations. Applied to both dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`).

---

### Migration: `20260602000001_add_delete_all_notifications`

**Why:** Previously notifications could only be deleted one at a time. After marking all notifications as read, users now have a single "Delete all" button in both the global and per-trip notification screens.

**Function:**
- `public.delete_all_notifications(p_trip_id UUID DEFAULT NULL)` — SECURITY DEFINER, `SET search_path = ''`; deletes all `notifications` rows where `user_id = auth.uid()`. If `p_trip_id` is provided, scopes deletion to that trip only. Follows the same pattern as `mark_all_notifications_read`.

**RLS note:** No RLS changes needed — the existing DELETE policy already allows users to delete their own rows. The RPC is used for consistency with the mark-all pattern (single call vs. N individual deletes).

**API layer:**
- `packages/api/src/notifications.ts` — added `deleteAllNotifications(tripId?: string)` calling the new RPC
- `packages/api/src/index.ts` — exports `deleteAllNotifications`
- `packages/types/src/schemas.ts` — added `DeleteAllNotificationsVariables = { tripId?: string }`

**Hook:** `useDeleteAllNotifications()` in `useNotifications.ts` — optimistic clear of the notifications cache + unread-count invalidation on settle.

**UI:** Both notification screens now render "Delete all" (red, `text-danger`) in the header when all notifications are read and the list is non-empty. "Mark all as read" continues to appear when any unread notifications exist (the two states are mutually exclusive).

**Local migration file:** `supabase/migrations/20260602000001_add_delete_all_notifications.sql`

---

### Migration: `20260602000002_add_self_assign_vehicle_passenger`

**Why:** Vehicle passenger management was restricted to the organizer or vehicle creator (by RLS INSERT/DELETE policy). Guests, participants, and the organizer now all have a "Join / Leave" button on every vehicle card to self-assign.

**Functions:**
- `public.join_vehicle(p_vehicle_id UUID)` — SECURITY DEFINER, `SET search_path = ''`; validates vehicle exists and not soft-deleted; validates `private.is_trip_member(v_trip_id, auth.uid())`; inserts `(vehicle_id, user_id=auth.uid(), is_driver=false)` with `ON CONFLICT DO NOTHING` (idempotent).
- `public.leave_vehicle(p_vehicle_id UUID)` — SECURITY DEFINER, `SET search_path = ''`; same member check; deletes the caller's own row.

**RLS:** No changes. The existing INSERT/DELETE RLS policies remain in place for the organizer/creator multi-select flow (`PassengerSelectSheet`). The new self-assign RPCs bypass RLS via SECURITY DEFINER and enforce membership themselves.

**API layer:**
- `packages/api/src/transferVehicles.ts` — added `joinVehicle(vehicleId)` and `leaveVehicle(vehicleId)`
- `packages/api/src/index.ts` — exports both

**Hooks:** `useJoinVehicle(tripId, vehicleId)` and `useLeaveVehicle(tripId, vehicleId)` in `useTransferVehiclePassengers.ts`.

**UI:**
- `VehicleCard.tsx` — added `joinAction?: React.ReactNode` prop, rendered between the pressable area and the expanded detail (always visible, outside the tap zone)
- `transfer.tsx` (VehicleCardWithPassengers) — renders a Join (green) or Leave (red) button for every member on every vehicle card; the existing organizer/creator "Passengers" multi-select button remains in the expanded detail section

**Local migration file:** `supabase/migrations/20260602000002_add_self_assign_vehicle_passenger.sql`

---

### Migration: `20260602000003_add_reset_all_prework`

**Why:** Each user's existing "Clear" button only deletes their own prework row (`DELETE WHERE user_id = auth.uid()`). The trip organizer needs a "Reset All Preferences" action that clears all members' rows for a clean restart. The existing RLS DELETE policy (`user_id = auth.uid()`) prevents direct deletion of others' rows, so a SECURITY DEFINER RPC is required.

**Function:**
- `public.reset_all_prework_preferences(p_trip_id UUID)` — SECURITY DEFINER, `SET search_path = ''`; raises exception if `NOT private.is_trip_organizer(p_trip_id, auth.uid())`; deletes all rows from `prework_preferences WHERE trip_id = p_trip_id`.

**API layer:**
- `packages/api/src/prework.ts` — added `resetAllPreworkPreferences(tripId)`
- `packages/api/src/index.ts` — exports it

**Hook:** `useResetAllPreworkPreferences(tripId)` in `usePrework.ts` — invalidates both `prework-preferences` and `my-prework-preferences` query keys on success.

**UI:** Prework tab screen (`trip/[id]/prework.tsx`) — organizer-only "Reset All Preferences" button (danger style) rendered below `GroupSummarySection`, visible only when `isOrganizer && hasAnyPreferences`. Guarded by a native `Alert.alert` confirmation dialog before executing.

**Local migration file:** `supabase/migrations/20260602000003_add_reset_all_prework.sql`

---

### Edge Function update: `push-notification` (2026-06-02)

**Changes:**
- `lost_found` notification type changed from preference-gated to always-on: `preferenceColumn()` now returns `null` for `lost_found` (same as `document_access_request`). The `lost_found` column in `notification_preferences` is retained but no longer consulted.
- Push notification title corrected from `'Lost & Found'` to `'Lost or Found'` (brand wording).
- The "Lost or Found" toggle was removed from `NotificationPreferencesSection.tsx` — the preference UI no longer exposes this column.

**Deployed to:** dev and prod via `supabase functions deploy push-notification`.

---

## 2026-06-02 — Multi-Topic Prework

### Migration: `20260602100000_create_prework_topics`

**Why:** The Prework feature was extended from a single flat preference list per trip to a multi-topic system. Organizers create named topics (e.g. "Trip Type", "Location", "Accommodation Filters"); each member distributes 100 credits independently per topic.

**Table created:** `public.prework_topics`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `trip_id` | UUID FK → trips CASCADE | |
| `title` | TEXT | CHECK length 1–100 |
| `description` | TEXT | nullable; max 500 chars; organizer context for members |
| `seeded_labels` | TEXT[] | default `{}`; max 20 items; organizer-suggested option labels |
| `position` | INT | ordering in segmented control, append-only |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ | `DEFAULT NOW()` |
| `updated_at` | TIMESTAMPTZ | `DEFAULT NOW()`, trigger-maintained |

**RLS:**
- SELECT: `private.is_trip_member(trip_id, auth.uid())`
- INSERT: `created_by = auth.uid() AND private.is_trip_organizer(trip_id, auth.uid())`
- UPDATE: `private.is_trip_organizer(trip_id, auth.uid())`
- DELETE: denied (use `delete_prework_topic` RPC)

**Changes to `public.prework_preferences`:**
- Added `topic_id UUID FK → prework_topics ON DELETE CASCADE` — NOT NULL
- Removed `description` column (moved to `prework_topics`)
- UNIQUE constraint changed from `(trip_id, user_id)` to `(topic_id, user_id)`
- Existing rows migrated: a default "General" topic was created per trip with existing data

**RPCs:**
- `delete_prework_topic(p_topic_id UUID)` — SECURITY DEFINER; organizer only; hard-deletes topic + cascades to all member preferences
- `reset_topic_preferences(p_topic_id UUID)` — SECURITY DEFINER; organizer only; deletes all member preferences for a single topic

**Realtime:** `prework_topics` added to `supabase_realtime` publication with `REPLICA IDENTITY FULL`.

---

### Migration: `20260602100001_prework_preferences_replica_identity`

**Why:** After the multi-topic migration, `prework_preferences` DELETE realtime events did not include `topic_id` in `payload.old` because REPLICA IDENTITY was set to DEFAULT (primary key only). Without `topic_id`, the `usePreworkRealtime` hook could not surgically invalidate the correct topic's cache and had to fall back to a broad `invalidateQueries` on every deletion.

**Change:** `ALTER TABLE public.prework_preferences REPLICA IDENTITY FULL` — ensures all columns, including `topic_id`, appear in DELETE event payloads so the hook can target the specific topic's query cache.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260602100001_prework_preferences_replica_identity.sql`

---

## 2026-06-02 — Trip Reminder Automatic Push Notifications

### Migration: `20260602120000_create_trip_reminder_cron`

**Why:** Trip members had no advance notice before a trip starts. Adds automatic push notifications at 7, 3, and 1 day(s) before every trip that is still in `planning` status.

**Architecture:** Reuses the existing notification pipeline end-to-end:
1. `private.create_trip_reminders()` inserts `notifications` rows (type `reminder`) for all trip members via the existing `private.create_trip_notification()` helper
2. The existing `dispatch-pending-push-notifications` pg_cron job (runs every minute) picks up the new rows and delivers them via the push-notification Edge Function
3. The Edge Function already handles `type = reminder` and checks the `reminder` preference column — members who disabled reminder notifications in trip settings will not receive the push

**Function:** `private.create_trip_reminders() RETURNS INTEGER` — SECURITY DEFINER, `SET search_path = ''`
- Queries `public.trips WHERE deleted_at IS NULL AND status = 'planning' AND (start_date - CURRENT_DATE) IN (1, 3, 7)`
- **Deduplication guard:** skips a trip if a `type = 'reminder'` AND `related_type = 'trip'` row already exists for that trip today — prevents double-sends on cron retry or if the job fires more than once (see `20260602130000` for the fix that replaced a buggy `LIKE` pattern with this discriminant)
- 1-day reminder: title `"Trip starts tomorrow: {title}"`, body `"Your trip starts tomorrow — time to get ready!"`
- 3/7-day reminders: title `"{N} days until {title}"`, body `"Your trip starts in {N} days!"`
- Notifies all members (exclude UUID = `'00000000-0000-0000-0000-000000000000'`, the nil UUID sentinel for "notify all")
- Sets `related_type = 'trip'`, `related_id = trip.id` — deep-link navigates to the trip root

**Cron job:** `create-trip-reminders` scheduled `0 9 * * *` (daily at 09:00 UTC — morning in European timezones)

**No Edge Function changes required** — trip-reminder title/body is set by the DB function and passed as fallback through `translateNotification`; the generic nudge i18n keys are not used.

**No types/hooks/UI changes required** — `type = 'reminder'` is already in the enum, the notification list renders it with the existing `NotificationItem`, and `resolveNotificationPath` already routes `reminder` to the trip root.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260602120000_create_trip_reminder_cron.sql`

---

### Migration: `20260602130000_fix_trip_reminder_dedup`

**Why (bug fix):** The dedup guard in `create_trip_reminders()` used `body LIKE '%trip starts in%'`, which matched the 3-day and 7-day reminders but not the 1-day reminder (`"Your trip starts tomorrow — time to get ready!"`). If the cron fired more than once per day, every trip starting tomorrow would receive duplicate push notifications.

**Fix:** Replaced the fragile body-text match with `related_type = 'trip'`. Organizer nudges (`send_organizer_nudge`) are inserted with `related_type = NULL`, so this discriminant correctly identifies automatic trip reminders without depending on body text. All three reminder windows (1, 3, 7 days) are now protected by the same guard.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260602130000_fix_trip_reminder_dedup.sql`

---

## 2026-06-03 — Notes Enhancement: is_done column

### Migration: `20260603000001_add_trip_notes_is_done.sql`

**Why:** Added a done/checked state to trip notes so any trip member can mark a note as completed. Supports a collapsible "Done" section in the Notes UI.

**Table altered:** `public.trip_notes`

| Change | Details |
|---|---|
| New column `is_done` | `BOOLEAN NOT NULL DEFAULT FALSE` |
| New RLS policy `trip_notes_update_member_is_done` | Any trip member may UPDATE (for toggling is_done); the trigger restricts non-owners to only changing is_done |
| Trigger `restrict_trip_note_update_fields` replaced | Now also prevents non-owners from modifying `title` or `description` |

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260603000001_add_trip_notes_is_done.sql`

---

## 2026-08-06 — Correction: Resend domain verification + apex SPF/DMARC

Not a database migration — no `supabase/migrations/` file. Logged here because it corrects a stale claim in the 2026-05-11 entry above and documents DNS state relevant to Supabase Auth email delivery.

**Correction to the 2026-05-11 "Config: Custom SMTP via Resend" entry:** that entry's "Known Limitation" section is stale. `vacationist.app` **is now domain-verified with Resend** — confirmed live via DNS: DKIM TXT record at `resend._domainkey.vacationist.app`, and SPF `v=spf1 include:amazonses.com ~all` at `send.vacationist.app` (Resend sends through Amazon SES). The Supabase SMTP sender email should be using a `@vacationist.app` address, not the free-tier `onboarding@resend.dev` fallback described in that entry — verify this in Supabase Dashboard → Authentication → SMTP Settings and update if it still shows the old sender.

**Why (this change):** An external site audit flagged vacationist.app as failing email authentication — no SPF or DMARC record existed at the domain apex, meaning nothing prevented a third party from sending spoofed mail claiming to be `@vacationist.app`. The `send.vacationist.app` subdomain SPF record (Resend's) was already correct; the apex had no record of its own at all.

**DNS records added** (Cloudflare, `vacationist.app` zone — DNS only, not a migration):

| Name | Type | Value |
|---|---|---|
| `vacationist.app` | TXT | `v=spf1 include:amazonses.com ~all` |
| `_dmarc.vacationist.app` | TXT | `v=DMARC1; p=none; sp=none; adkim=r; aspf=r;` |

`p=none` is a deliberate monitoring-only posture — no `rua=` reporting address, since the domain has no MX record and third-party DMARC report senders require an authorization record at the *receiving* domain, which cannot be published for a Gmail address. Tightening to `p=quarantine`/`p=reject` is a future step, not blocked by this record.

**Also:** the missing security response headers (HSTS, X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy) flagged by the same audit are delivered via a Cloudflare Transform Rule on the `vacationist.app` zone, not via any file in this repo — see the note in `CLAUDE.md`'s Marketing Site section. GitHub Pages (which serves `docs/`) has no mechanism for custom response headers.

### Update 2026-08-06 (same day): Cloudflare proxy + headers deployed live

The above was executed via the Cloudflare API (authenticated MCP access), not the dashboard. Two things worth recording precisely, since a hand-written "plan" for this work (including an earlier draft of this session's own plan) got some of the mechanism wrong and would not have worked as written:

- **The ACME HTTP-01 exemption is a custom Redirect Rule, not a Configuration Rule.** Cloudflare's Configuration Rules have no field that can carve a path-level exemption out of the "Always Use HTTPS" toggle — `action_parameters` for `set_config` accepts `automatic_https_rewrites`, `ssl`, `security_level`, etc., but nothing named `always_use_https`. The legacy Page Rules `always_use_https` action is presence-only (it can force HTTPS for a matched pattern, it cannot un-force it) — no built-in mechanism grants a path-level opt-out from the zone-wide toggle. The zone's built-in "Always Use HTTPS" setting is left `off` permanently; instead, a custom Redirect Rule (phase `http_request_dynamic_redirect`, rule ref `force_https_except_acme`, ruleset ID `a781e92778834bca898fe315547ed4f6`) does the redirect itself: `not ssl and not starts_with(http.request.uri.path, "/.well-known/acme-challenge/")` → 301 to the HTTPS equivalent, `preserve_query_string: true`. **Do not enable the zone's built-in Always Use HTTPS toggle** — this custom rule fully replaces it; turning the toggle on too would be redundant (harmless, since the ACME path already skips both) but adds a second thing to keep in sync.
- **The response-header Transform Rule** (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, CSP) lives in ruleset phase `http_response_headers_transform` (not `http_response_headers` — that phase name doesn't exist), action `rewrite` (not `set_response_headers` — that action doesn't exist either). Ruleset ID `4722ba5424cc4b409525deabe507800a`, rule ref `security_headers_for_audit`.
- **Live-verified** post-deploy: `curl -I https://vacationist.app/` shows `Server: cloudflare` and all five headers; `http://vacationist.app/.well-known/acme-challenge/<token>` returns without a redirect (404, since no real token exists — the point is it did *not* 301); `http://vacationist.app/` correctly 301s to https; `/.well-known/assetlinks.json` still serves 200.
- HSTS: zone setting `security_header.value.strict_transport_security` — `enabled: true, max_age: 31536000, include_subdomains: true, preload: false`.
- All four apex A records are now `proxied: true` (previously DNS-only). Zone SSL/TLS mode was already `strict` before this session.

**Still outstanding (not yet done):** send a real magic-link auth email and confirm delivery — this is the one check in the original verification plan that requires a live email round-trip and wasn't performed as part of this change.

---

## 2026-08-08 — Fix: `ensureUserProfile`'s `isNew` was structurally always false

**Why:** During Phase 14 live testing, the Reddit `attribution-capi` Edge Function never fired for a genuinely new sign-up — including with a completely fresh, never-before-seen email on dev. Root cause: `public.users` has had a trigger since Phase 1 (`on_auth_user_created` → `handle_new_user()`, `20260511000001_create_users_table.sql:67-70`) that inserts the profile row server-side the instant `auth.users` gets a new row — **before** the client ever calls `ensureUserProfile()`. `ensureUserProfile`'s `SELECT ... WHERE id = ...` therefore always found an existing row and always returned `isNew: false`, for every sign-up, ever. This was not a race condition or a symptom of the account-deletion/`trackedUserId` bugs fixed earlier in this same investigation — those were real bugs too, but this is the actual root cause underneath them, present since the table was created.

Considered inferring novelty from `session.user.created_at` vs `last_sign_in_at` (a commonly cited trick) but Supabase's docs don't document the exact timing guarantee for magic-link flows, so it was rejected as an unverified guess for something that drives real ad-spend attribution.

**Changes:**

| Change | Detail |
|---|---|
| New column `public.users.signup_attribution_claimed_at` | `TIMESTAMPTZ`, nullable, no default |
| `packages/api/src/users.ts` | `ensureUserProfile()` no longer returns `isNew` (removed `EnsureUserProfileResult`, now just returns `User`). New `claimSignupAttribution(userId)` atomically claims the column via `UPDATE ... WHERE signup_attribution_claimed_at IS NULL RETURNING id` — race-safe under Postgres row locking even when `loadSession()` and `onAuthStateChange` resolve concurrently for the same sign-in. |
| `apps/mobile/src/features/consent/utils/trackSignUp.ts` | `maybeTrackSignUp(profile)` — dropped the `isNew`/`previousIsGuest` params entirely. Guest exclusion still via `profile.is_guest`; guest-upgrade-to-real-account is now handled for free (guests never claim while still guests, so the column stays unclaimed until they convert). Consent check (web) still happens before claiming, so an unclaimed attribution stays available for a retry on a later resolve if consent wasn't granted yet. |
| `apps/mobile/src/features/auth/hooks/useAuthInit.ts` | Both `ensureUserProfile()` call sites updated for the new signature; `maybeTrackSignUp` calls simplified. |
| `packages/api/src/messages.ts` | Unrelated fix surfaced by regenerating types against actual current dev schema (the committed `database.types.ts` had drifted): `get_trip_messages`'s `p_cursor` RPC arg is `string \| undefined`, not `string \| null` — `cursor ?? null` → `cursor`. |

**Verification:** `npm run typecheck` exits 0; `npm test` — 94/94 mobile tests + full `consent.test.js` suite pass. End-to-end confirmation that a genuinely new sign-up now produces a successful `attribution-capi` call is still pending a real test (tracked as an open item below).

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`) — additive nullable column, non-destructive, backwards-compatible.

**Local migration file:** `supabase/migrations/20260808120000_add_signup_attribution_claim.sql`

---

## 2026-08-08 (same day) — Fix: `attribution-capi` had no CORS handling — a second, independent blocker

**Why:** After the `isNew` fix above, a live retest against dev showed `claimSignupAttribution` correctly returning `true`, but the actual Reddit-attribution report still never landed. The dev Edge Function logs showed the real request: `OPTIONS | 405 | .../attribution-capi`. `attribution-capi`'s handler started with `if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })` and had no CORS handling at all — no `OPTIONS` branch, no `Access-Control-Allow-*` headers anywhere. Since the function is called directly from a browser (`reportSignUpAttribution()` in `packages/api/src/analytics.ts`, via `supabase.functions.invoke()`) with a `POST` + custom `Authorization` header + JSON `Content-Type`, the browser is required to send a CORS preflight `OPTIONS` request first — and this function 405'd it, so the real POST was never even attempted. This is a genuinely separate bug from the `isNew` one: it was invisible all session because the `isNew` bug meant the call was never attempted in the first place, so this CORS gap was never exercised until today's fix let a real attempt reach the network.

Confirmed via `console.error` placement in the function: it only logs on failure paths (auth rejection, DB insert failure, Reddit CAPI rejection) — a fully successful run is silent by design, which is why the Boot → Shutdown (`EarlyDrop`) log pair for the one claim-succeeding call earlier in this investigation showed no application log lines; that read as ambiguous until the actual `OPTIONS | 405` request line was found in the logs.

**Fix:** added an origin-allowlisted CORS layer, mirroring `track-event`'s pattern but narrower (this function is only ever called from an authenticated app session, never the marketing site): `https://web.vacationist.app` + `http://localhost:8081` (the Expo web dev server) in `ALLOWED_ORIGINS`; `Access-Control-Allow-Headers: authorization, content-type, apikey, x-client-info` (the actual header set `supabase.functions.invoke()` sends); an `OPTIONS` branch returning `204` before the method check; every existing response updated to carry the CORS headers. Native callers are unaffected — CORS is browser-only, and the function's own `auth.getUser()` check (not origin) is what actually protects the endpoint.

**Verification:** `curl -X OPTIONS` with `Origin: http://localhost:8081` against dev now returns `204` with the correct `Access-Control-Allow-*` headers (previously `405`).

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`) via `supabase functions deploy attribution-capi` — code-only change, no migration file.

**Confirmed end-to-end (same day):** a real sign-up on dev now produces `claimSignupAttribution => true` → `reportSignUpAttribution` → `attribution-capi` `POST | 204` (authenticated, `x-client-info: supabase-js-web/2.105.4`) → a matching row in `analytics_events` (`event_name: 'sign_up'`, `surface: 'web_app'`, correct `user_id`/`created_at`). That test had no `rdt_cid` (direct localhost sign-up, not via a real Reddit click), so it exercised the log-write path but not the Reddit CAPI POST branch itself — that still awaits a real ad-click-driven test. The temporary `debugTrail()` instrumentation added during this investigation (`trackSignUp.ts`, `useAuthInit.ts`) has been removed now that the fix is confirmed working.

---

## 2026-08-09 — Phase 15: Multi-Currency Expense Support

**Why:** Expenses had a per-row `currency` column that was write-only dead weight — `CreateExpenseSheet` never let a user choose it, and `get_trip_balances` summed raw `amount` with zero currency awareness, safe only because every trip had, in practice, exactly one currency. Tech Lead requested full per-expense multi-currency support (an expense can be entered in any currency and auto-converts to the trip's base currency for balance math), a "Show in ⟨currency⟩" display toggle for settling in cash, coverage of the full set of European ISO-4217 currencies, and an email alert when the currency landscape changes (e.g. a country adopting the euro — concretely relevant since Bulgaria adopts the euro 1 Jan 2026).

**FX data source:** [Frankfurter](https://frankfurter.dev) — free, no API key, no rate limits, ECB-sourced. Verified live: `GET /v1/latest?base=EUR` and `GET /v1/currencies` both return real data; the European subset it prices today is CHF, CZK, DKK, GBP, HUF, ISK, NOK, PLN, RON, SEK, TRY (+ EUR, USD) — it does **not** cover BGN, RSD, BAM, MKD, ALL, UAH, MDL, BYN, GEL, AMD, AZN, GIP, so those are seeded into `currency_catalog` with `is_rate_available = false` (selectable, but conversion is disabled until/unless a rate appears).

**Decision (Tech Lead, via plan review):** cron-cached daily rate table, not live per-request API calls — fits the app's offline-first architecture, zero cost, no rate-limit exposure. Also: the `base_currency` lock (documented since Phase 4b as "cannot change after first expense" but never actually enforced in code) is now enforced at the DB level, since a retroactive change would silently corrupt every frozen per-expense conversion.

**Migrations** (`supabase/migrations/20260809100000` through `20260809100008`):

| File | Change |
|---|---|
| `20260809100000_create_currency_catalog.sql` | `currency_catalog` table, RLS (authenticated SELECT, service_role-only writes — same hybrid pattern as `analytics_events`), seeded with 25 curated European currencies + USD |
| `20260809100001_create_exchange_rates.sql` | `exchange_rates` table (EUR-relative, one row per currency per day), same RLS shape, `private.get_latest_exchange_rate()` helper |
| `20260809100002_create_currency_drift_alerts.sql` | `currency_drift_alerts` audit table, fully service_role-locked (no client access at all) |
| `20260809100003_currency_columns_to_fk.sql` | `trips.base_currency` / `expenses.currency` / `settlement_receipts.currency` — `CHECK ('EUR','CHF','USD')` → `REFERENCES currency_catalog(code)` |
| `20260809100004_add_expense_fx_columns.sql` | `expenses.exchange_rate` (default 1), `expenses.converted_amount` (backfilled = `amount`, then `NOT NULL`), `expense_splits.amount_owed_original_currency`, `users.preferred_currency` |
| `20260809100005_lock_base_currency_after_expense.sql` | `BEFORE UPDATE` trigger on `trips` — rejects a `base_currency` change once the trip has any expenses |
| `20260809100006_update_expense_rpcs_fx.sql` | `create_expense_with_splits` + `update_expense_with_splits` (new `p_currency` param) — resolve and freeze `exchange_rate`/`converted_amount`, validate currency against `currency_catalog.is_active` |
| `20260809100007_fix_balance_rpcs_converted_amount.sql` | `get_trip_balances`, `settle_all_expenses`, `private.create_expense_reminders` — sum `converted_amount` instead of raw `amount` |
| `20260809100008_create_fetch_exchange_rates_cron.sql` | `private.trigger_fetch_exchange_rates()` + daily `pg_cron` job (`05:30 UTC`), following the `dispatch_pending_push_notifications` vault-secret template |

**Backwards compatibility:** every existing trip/expense is single-currency (`currency === base_currency`), so `exchange_rate = 1`, `converted_amount = amount`, `amount_owed_original_currency = NULL` for all of them — numerically identical balance/settlement output to before this phase. Same-currency expenses never depend on the FX feed being populated (the RPCs skip the rate lookup entirely when `p_currency = base_currency`).

**Edge Function:** `supabase/functions/fetch-exchange-rates/index.ts` (new) — fetches Frankfurter's latest rates + currency list, upserts `exchange_rates`, diffs the feed against `currency_catalog.is_rate_available` (2-consecutive-day grace period before alerting, to avoid false positives from a transient API hiccup), and emails the Tech Lead via Resend on any change (lost/gained/unknown-new). `RESEND_API_KEY` is a **new** Edge Function secret — no application-level email sending existed anywhere in this repo before this phase (Resend was previously wired only as Supabase Auth's SMTP provider). `FX_RATES_SECRET` (shared-secret auth, same constant-time-compare pattern as `PUSH_NOTIFICATION_SECRET`) and `FX_ALERT_EMAIL` are also new secrets. `verify_jwt = false` added to `supabase/config.toml`.

**Types/schemas:** `Currency` (`packages/types/src/enums.ts`) changed from a 3-value literal union to `type Currency = string` — deliberate: the currency list is now DB-driven and can change without an app deploy, which a compile-time union can't express. Zod validation is now structural (`z.string().length(3).regex(/^[A-Z]{3}$/)`); authoritative validation lives in the RPCs (`currency_catalog.is_active` check), matching the existing "Input Validation in RPCs" pattern. `updateExpenseWithSplitsSchema` gained a `currency` field it never had (editing an expense's currency was previously impossible).

**Frontend:** new `apps/mobile/src/features/currencies/` (hooks: `useCurrencies`, `useExchangeRates`, `useCurrencyConversion`; component: `CurrencyPickerSheet`, a searchable bottom sheet modeled on `CopyPackingListSheet`). `CreateExpenseSheet`/`EditExpenseSheet` gained a currency field + live converted-amount preview + submit-disable when a rate is unavailable. `ExpenseCard`/`ExpenseSplitBreakdown` show the original-currency amount as primary with a muted converted line when it differs from the trip's base currency. Expenses tab gained a "Show in ⟨currency⟩" toggle (stats row) wired into `SettlementsModal`'s balances/settlements sections only — receipts (immutable history) always stay in the true trip currency regardless of the toggle, since converting a historical settlement with today's rate would be misleading. `trip/create.tsx` / `EditTripSheet.tsx` currency dropdowns now pull from `useCurrencies()` with an inline search box (kept as the existing expandable-dropdown shape per Tech Lead direction, not the new modal sheet) and fixed two pre-existing hardcoded hex colors in the process; `EditTripSheet` also hides/disables the currency field once the trip has any expenses, ahead of the DB trigger. `EditProfileSheet` gained an optional `preferred_currency` field, used as the default "Show in X" currency.

**Tests:** new `packages/utils/src/currencyConversion.ts` (+ `.test.ts`) — pure `convertAmount()` cross-rate math. `packages/utils/src/settlements.ts` and its 40 existing tests are unchanged (it's currency-agnostic by design — operates on pre-converted `MemberBalance[]`).

**Verification performed on dev (`aejywkbkcwyanhyzhrle`), same day:**
- `npx supabase db push` — all 9 migrations applied cleanly, no errors.
- `npx supabase gen types typescript --linked` — regenerated `packages/api/src/database.types.ts` successfully; removed the temporary defensive casts (`(supabase as unknown as {...})`) from `packages/api/src/currencies.ts` and `users.ts` now that real generated types cover the new tables/columns.
- **Found and fixed a pre-existing, unrelated bug while doing this:** the root `package.json` `supabase:types` script used `supabase gen types typescript --local`, which requires a local Dockerized Postgres that does not exist on this machine (matches the already-documented "no Docker on this machine" constraint) — running it did not error, it silently truncated `database.types.ts` to a single-line error message (2707 lines → 1). Recovered via `git checkout`. Fixed the script to use `--linked` instead, which is what actually works here.
- `npm run typecheck` — exits 0.
- `npm test` — 92/92 (`packages/utils`, includes new `currencyConversion.test.ts`) + 94/94 (`apps/mobile`) + full marketing consent suite, all green.
- `fetch-exchange-rates` deployed to dev (`--no-verify-jwt`). `FX_RATES_SECRET` (random 64-hex-char secret) and `FX_ALERT_EMAIL` (`tdkiodok@gmail.com`) set as Edge Function secrets. Vault secrets `fetch_exchange_rates_edge_fn_url` / `fetch_exchange_rates_secret` created via `vault.create_secret()`.
- Manually invoked `private.trigger_fetch_exchange_rates()` twice: `exchange_rates` populated with exactly the 13 currencies seeded as `is_rate_available = true` (as_of `2026-08-07`, the last ECB business day before the Saturday/Sunday gap), stable at 13 rows across both runs (confirms the upsert is idempotent, not accumulating duplicates).
- **Found and fixed a real bug in the drift-detection logic during this test:** the "currency Frankfurter tracks but we don't know about" branch had no dedup — it unconditionally re-reported all ~17 non-European currencies Frankfurter also carries (AUD, JPY, CAD, CNY, INR, ...) on *every* run, which would have emailed the Tech Lead the same 17-item list daily forever. Fixed by checking `currency_drift_alerts` for previously-reported `new_unknown` codes before alerting again; redeployed and confirmed the second trigger produced zero new rows (stayed at 17, not 34).
- **Not verified:** the actual Resend email send — `RESEND_API_KEY` was deliberately not set (no real key available this session), so the email branch of `sendDriftAlertEmail()` no-ops by design (`if (!apiKey || ...) return;`) rather than failing. The drift-detection logic itself is confirmed correct via the `currency_drift_alerts` table; only the final email delivery step is unverified. Set `RESEND_API_KEY` via `supabase secrets set` before relying on the alert email for a real event like Bulgaria's euro adoption.
- **Not yet done:** prod push (`fsfsqghbejwvgxujoyne`) — held pending a separate go-ahead given the size of this change (4 rewritten RPCs, new columns on `trips`/`expenses`/`expense_splits`/`users`). Browser/UI verification (expense currency flow, "Show in X" toggle, theme checks across dark/light/colorful/system) also not yet performed.

### Same-day follow-up: prod-safety fix + Tech Lead UI testing round

**Prod-blocking bug found before any prod push happened:** `update_expense_with_splits` (`20260809100006`) dropped the old 6-param overload and made `p_currency` required. Prod is running app **v1.27.0** (confirmed via `app.config.ts` version history), which calls this RPC with a 6-key JSON payload (no `p_currency`) — PostgREST resolves RPC calls by matching JSON keys to named parameters, so any user still on that build (the entire prod install base, until they update) would have "edit expense" hard-fail the moment this migration reached prod. This app update ships via OTA (no native changes), which still needs a moment to reach already-running sessions — pushing the DB change first is not safe on its own.

**Fix:** `20260809110000_backward_compat_update_expense_rpc.sql` — `p_currency TEXT DEFAULT NULL`; when omitted (old app), the expense keeps its existing currency (functionally identical to pre-Phase-15 behavior, which never let a user change currency anyway). `20260809110001_drop_old_update_expense_overload.sql` — a required follow-up: `CREATE OR REPLACE` only replaces a function whose argument *types* match positionally in order; moving `p_currency` from position 4 to position 7 created a second overload instead of replacing the first (reintroducing the exact ambiguity being fixed), caught by inspecting `pg_proc` after applying `110000` and cleaned up immediately. Verified via `pg_get_function_arguments` that exactly one `update_expense_with_splits` overload exists post-fix, with `p_currency` defaulted. Both migrations applied to dev.

**Verdict: safe to push to prod now** (not done — holding per Tech Lead instruction). `create_expense_with_splits`'s signature was never changed (already had `p_currency` in the same position before this phase), so it needed no equivalent fix.

**UI bugs found in Tech Lead device testing, fixed same day:**
1. Trip create/edit currency dropdown list wasn't scrollable (search worked). Root cause: a `ScrollView` nested inside the form's own `ScrollView` — Android requires `nestedScrollEnabled` explicitly for this (iOS supports it by default per RN docs, which is why it wasn't caught in the earlier pass). Added `nestedScrollEnabled` to both `trip/create.tsx` and `EditTripSheet.tsx`.
2. `CurrencyPickerSheet` (new-expense currency picker): the Android keyboard covered the search bar + results when typing, since the sheet was a bare `Modal` with no keyboard-avoiding behavior — unlike `CreateExpenseSheet`/`EditExpenseSheet`, which already wrap in `KeyboardAvoidingView`. Added the same wrapper.
3. New expense should default to the last currency the user picked, not always the trip's base currency. Added `apps/mobile/src/features/currencies/utils/lastUsedCurrency.ts` (MMKV on native, `localStorage` on web — mirrors `useTutorialSeen.ts`'s platform split, since `react-native-mmkv` has no web support). `CreateExpenseSheet` now defaults to it; both create/edit sheets update it whenever a currency is picked.
4. Confirmed (not a bug): the "no conversion" badge on 12 of 25 seeded currencies (BGN, RSD, BAM, MKD, ALL, UAH, MDL, BYN, GEL, AMD, AZN, GIP) is accurate — Frankfurter/ECB genuinely doesn't price them. **Tech Lead decision: track broadening real coverage (a second FX data source for these) as separate future follow-up work, not part of this pass.**

**Verification:** `npm run typecheck` exits 0, full test suite green, after all of the above. Device-level Android re-test of the three UI fixes has not been re-confirmed by the Tech Lead yet as of this entry.

**Same-day: currency drift email confirmed working end-to-end.** `RESEND_API_KEY` added to both dev and prod via `supabase secrets set` (Tech Lead). `FX_ALERT_EMAIL` updated on dev to the Tech Lead's primary address. Re-triggered `private.trigger_fetch_exchange_rates()` after clearing `currency_drift_alerts` to force fresh (real, not fake) drift events — Edge Function returned `200` with 17 events; Tech Lead confirmed the alert email arrived and "looks perfect."

---

## 2026-08-09 (same day) — Phase 15b: Broaden FX Coverage (dev only, prod held)

**Why:** the 12 currencies Frankfurter/ECB doesn't price (BGN, RSD, BAM, MKD, ALL, UAH, MDL, BYN, GEL, AMD, AZN, GIP) showed "no conversion" for every user — confirmed as a real gap in the prior entry, explicitly deferred, now actioned per Tech Lead request.

**Researched before implementing (not assumed):**
- **Bulgaria adopted the euro on 1 January 2026**, cash changeover completed, euro sole legal currency since 1 February 2026 ([Consilium](https://www.consilium.europa.eu/en/press/press-releases/2025/07/08/bulgaria-ready-to-use-the-euro-from-1-january-2026-council-takes-final-steps/), [ECB](https://www.ecb.europa.eu/euro/changeover/bulgaria/html/index.en.html)) — BGN is a genuinely retired currency, not merely unpriced.
- [`open.er-api.com`](https://www.exchangerate-api.com/docs/free) (ExchangeRate-API's free "open access" endpoint) verified live to cover all 12 gap currencies, including the least-likely ones (BYN, AZN, GEL, AMD). No API key, once-daily usage is within their free-tier terms, commercial use for currency conversion is permitted, caching allowed (redistribution is not — we only use rates for our own users' conversion display). Attribution ("Rates By Exchange Rate API", linked) is contractually required — added as a tappable credit line, not skipped.

**Migration `20260809120000_add_exchange_rate_source_and_retire_bgn.sql`:**
- `exchange_rates.source TEXT NOT NULL DEFAULT 'ecb' CHECK (source IN ('ecb', 'exchangerate-api'))` — existing rows correctly default to `'ecb'`, the only source that has ever written to this table until now.
- `UPDATE currency_catalog SET is_active = false WHERE code = 'BGN'` — soft-disable only, existing BGN-denominated trips/expenses untouched. Deliberately a one-time data change, not something the automated drift system can infer: `open.er-api.com` still happily returns a BGN rate (a static echo of the fixed 1.95583 conversion peg, not a live traded rate — the currency-board rate for BAM coincidentally shares this exact number for unrelated historical reasons).

**`supabase/functions/fetch-exchange-rates/index.ts`:** now fetches `open.er-api.com/v6/latest/EUR` alongside the two existing Frankfurter calls. Frankfurter stays primary — for any currency both sources price, Frankfurter's rate is used and the secondary source's value for that code is simply skipped, so none of the 13 already-working currencies change provenance. The secondary fetch degrades gracefully (own try/catch, returns `null` on any failure) rather than aborting the whole run — a `open.er-api.com` hiccup must never also stop Frankfurter's own working update. Drift-event `details` text now names which feed newly priced a currency.

**UI:** `packages/types/src/database.ts`'s `ExchangeRate` gained an optional `source` field (unused by any current caller — audit-only). Added a tappable attribution credit line (`Linking.openURL('https://www.exchangerate-api.com')`, `field.ratesAttribution` in `expenses.json` en/de, containing their required verbatim string "Rates By Exchange Rate API") to `CurrencyPickerSheet`'s footer and `SettlementsModal`'s rates-as-of footnote. No hook, picker, or expense-entry logic needed to change — `is_rate_available` was already the generic signal every UI surface reads; flipping it via the catalog is the entire user-facing effect.

**Verified on dev, same session:**
- `npm run typecheck` exits 0; full test suite green (no `packages/utils`/hook logic changed by this phase).
- Migration pushed, function redeployed, manually triggered via `private.trigger_fetch_exchange_rates()`.
- Response: `{"as_of":"2026-08-07","rates_upserted":25,"secondary_source_used":true,"drift_events":12}` — up from 13 rates to all 25.
- `exchange_rates` for the latest `as_of`: 13 rows `source='ecb'`, 12 rows `source='exchangerate-api'` — exactly the expected split.
- `currency_catalog`: all 24 active currencies now `is_rate_available = true`; `BGN` is `is_active = false` (hidden from every picker via `getCurrencies()`'s existing `WHERE is_active` filter) while technically `is_rate_available = true` (harmless — no UI ever surfaces a currency with `is_active = false`, this is just an artifact of the drift-detection loop not special-casing retired currencies, which is correct: `is_active` is deliberately the sole picker-visibility gate).
- 12 drift events generated as expected: 11 real "gained" currencies (RSD, BAM, MKD, ALL, UAH, MDL, BYN, GEL, AMD, AZN, GIP) plus BGN also technically "gained" a rate the same run (harmless per above, but worth knowing if the alert email looks odd — BGN appearing as "gained" right after being marked inactive is expected, not a bug).

**Not yet done:** prod push — held pending explicit go-ahead, same as Phase 15 itself. Device/browser re-check of the picker no longer showing "no conversion" for the 11 newly-covered currencies not yet performed.

---

## 2026-08-09 (same day) — Prod push: Phase 15 + 15b, and a cron-timeout fix found in the process

**Go-ahead given** after re-verifying prod's actual pre-push state (`supabase migration list --linked` against `fsfsqghbejwvgxujoyne`: clean at `20260808120000`, exactly the 12 pending migrations expected, no drift) rather than assuming it.

**Applied to prod (`fsfsqghbejwvgxujoyne`), in order:**
1. `supabase db push` — all 12 migrations (`20260809100000` → `20260809120000`): currency tables, FX columns, the base-currency lock trigger, the FX-aware RPC rewrite, the balance-calc fixes, the daily cron, the backward-compat fix + overload cleanup, and the broadened-coverage migration. Verified via `pg_proc` post-push that `update_expense_with_splits` has exactly one overload with `p_currency` defaulted (`pronargs: 7, pronargdefaults: 1`) — the prod app (v1.27.0) continues to work unmodified.
2. `fetch-exchange-rates` deployed to prod (`--no-verify-jwt`).
3. New prod secrets: `FX_RATES_SECRET` (freshly generated, deliberately **not** the same value as dev's) and `FX_ALERT_EMAIL` (`Gary-Lude@web.de`). `RESEND_API_KEY` was already set by the Tech Lead directly.
4. Vault secrets `fetch_exchange_rates_edge_fn_url` (pointing at the prod function URL) / `fetch_exchange_rates_secret` created via `vault.create_secret()`.

**Bug found on the very first prod trigger — `net.http_post`'s default 5000ms timeout is too short for this function's cold start.** `private.trigger_fetch_exchange_rates()` logged `"Timeout of 5000 ms reached"` in `net._http_response` with a `null` status — but the Edge Function was **not** actually cancelled by pg_net giving up on the wait, and completed successfully ~33s later (confirmed: `exchange_rates` populated with 25 rows, `fetched_at` timestamped well after the logged timeout). Harmless *this once*, but the daily cron only invokes this function once every 24 hours, meaning it never stays warm between runs — every single scheduled run would hit the same cold-start timeout and log a false failure in `net._http_response`, permanently misleading anyone debugging this later (exactly the kind of "invisible until someone checks the wrong signal" class of bug already seen once this phase, with `attribution-capi`'s missing CORS handling). Fixed in `20260809130000_increase_fx_fetch_timeout.sql` — `net.http_post(..., timeout_milliseconds := 45000)`, comfortably above the observed 33s. Applied to **both** dev and prod (dev first, per the standard workflow) before re-verifying. Re-triggered on prod post-fix: clean `200`, `error_msg: null`, `drift_events: 0` (correctly found nothing new — all 25 currencies were already correctly flagged from the first, timed-out-on-client-but-actually-successful run).

**Final verified state on prod, same as dev:** `currency_catalog` — every currency `is_rate_available = true` except the one `is_active = false` row (BGN, correctly retired). `npm run typecheck` clean.

**Not yet done:** the app update carrying the new multi-currency UI (ships via OTA, no native changes needed) — decoupled from this DB/infra push by design (the backward-compat RPC fix exists specifically so this isn't a blocking dependency). Device/browser re-check of the currency picker on prod not yet performed.

---

## 2026-08-09 (same day) — Set-based notification fan-out (dev + prod)

**Why:** production-hardening audit flagged `private.create_trip_notification()` as looping `trip_members` and issuing one single-row `INSERT ... RETURNING` per recipient, synchronously inside the same transaction as whatever triggered it (new activity, new expense, new member, vote finalized, schedule change, member left, etc.) — latency on ordinary writes that scaled linearly with trip size. Part of a broader remediation plan for trips that grow well past the 4–12-person range the app was designed and tested around (member cap itself deliberately deferred per Tech Lead decision — Phase 11 stays gated on ~500 MAU).

**Migration `20260809140000_set_based_notification_fanout.sql`:** `CREATE OR REPLACE FUNCTION private.create_trip_notification(...)` — identical 10-param signature, only the body changed. The per-row `FOR v_member IN SELECT ... LOOP INSERT ... RETURNING id INTO v_notification_id` loop became a single `INSERT INTO public.notifications (...) SELECT ... FROM public.trip_members WHERE trip_id = p_trip_id AND user_id != p_exclude_user_id RETURNING id, user_id`, wrapped in a CTE. `v_notification_ids`/`v_user_ids` are now built via `array_agg(id ORDER BY user_id)` / `array_agg(user_id ORDER BY user_id)` over that one CTE — both aggregates ordered by the identical key over the identical row set, which is what keeps them positionally aligned (the push-notification edge function maps each Expo push back to its `notification_id` via this pairing). Everything else preserved exactly: the `app.batch_push_pending` GUC still brackets the insert (the per-row `trg_dispatch_push_notification` AFTER INSERT trigger still fires once per row even on a set-based insert — the GUC is what suppresses its per-row HTTP dispatch), `!=` (not `IS DISTINCT FROM`) on the exclude comparison, and the three early exits in the same order (no recipients / `pg_trigger_depth() >= 1` / missing vault secret).

**Verified on dev before prod push:** wrote a `BEGIN; ... ROLLBACK;` script against a real trip with 3 members (`2bf87b32-9ed0-485f-8d78-feae41cb6e5c`) — called the function excluding one member, asserted exactly 2 notification rows were created, exactly for the 2 non-excluded members, no duplicates, and confirmed the transaction actually rolled back (0 matching rows left afterward). All assertions passed (no `RAISE EXCEPTION` surfaced — confirmed the harness does surface those as CLI errors, since an earlier attempt using synthetic UUIDs correctly failed loudly on `users_id_fkey`, which is why the real-trip approach was used instead). `npm run typecheck` / `npm test` unaffected (Postgres-only change, no client code touched).

**Prod push:** signature-identical `CREATE OR REPLACE`, non-destructive, no data migration — pushed immediately per the standard "safe, backwards-compatible" criteria. `supabase migration list --linked` against prod confirms `local == remote` for every migration through `20260809140000` with no gaps. (`supabase db dump --schema-only` is not available in this CLI version/environment — see the "No Docker on this machine" note; migration-ledger parity was used instead, sufficient here since this is a single deterministic function replacement applied via the identical migration file to both environments.)

**Not changed, deliberately:** the ~19 call sites (triggers, RPCs, pg_cron jobs) that invoke this function — only its internals changed. The push-notification edge function's own `sendToExpo` chunking (100 messages/request) was fixed separately in the same remediation pass, client-side only, no migration.

---

## 2026-08-09 (same day) — push-notification edge function deployed (dev + prod)

**Why:** the `sendToExpo` chunking fix (100-message batches, see above) existed only in the repo — never actually deployed this remediation pass. Closing that gap now that the rest of the session's changes (recipe→shopping-list sync fix, activities pagination, this migration) were manually re-verified.

**Deployed:** `supabase functions deploy push-notification` — dev (`aejywkbkcwyanhyzhrle`, v36→v37), then prod (`fsfsqghbejwvgxujoyne`, v36→v37). Confirmed via `supabase functions list` on both (version bump + `updated_at`). No secrets, no signature, no payload-shape change — purely internal chunking of the outbound Expo array, so no coordinated app-side change was needed. Re-linked to dev afterward per the standard workflow.

---

## 2026-08-15 — Add maps_url to accommodations (Base)

**Why:** v1.31.0 adds a location-link field to Base entries (a Google Maps link, alongside the existing booking `external_url`), matching the `maps_url` column `activities` already had (added `20260512200000_create_activities_and_votes.sql`, HTTPS-enforced by `20260512200002_enforce_https_urls.sql`) but that accommodations never got.

**Migration `20260815100000_add_accommodation_maps_url.sql`:**
```sql
ALTER TABLE public.accommodations ADD COLUMN maps_url TEXT;
ALTER TABLE public.accommodations
  ADD CONSTRAINT accommodations_maps_url_https
    CHECK (maps_url IS NULL OR maps_url LIKE 'https://%');
```
Nullable, additive, no backfill needed. No trigger change — `restrict_accommodation_update_fields()` only guards `trip_id`/`created_by`/`voting_open`/`status`, so `maps_url` updates freely through the normal owner/organizer RLS path. No FK to `users`, so `delete_own_account()` is unaffected.

**Dev push:** `supabase link --project-ref aejywkbkcwyanhyzhrle && supabase db push` — applied cleanly.

**Prod push:** additive nullable column + a `CHECK` that only constrains a column with no existing rows referencing it — meets the standard "safe, backwards-compatible" bar, pushed immediately: `supabase link --project-ref fsfsqghbejwvgxujoyne && supabase db push`. Re-linked to dev afterward per the standard workflow.

**App-side:** `Accommodation` type, `createAccommodationSchema`/`updateAccommodationSchema` (`httpsUrlSchema.nullable().optional()`, mirroring the `activities` schema), `createAccommodation` API, Create/Edit Base sheets, and `AccommodationCard`'s location row. Activities gained the equivalent **UI only** (`CreateActivitySheet`/`EditActivitySheet`/`ActivityCard`) — the column and Zod field already existed but had no form/display wired up.

**Also fixed while here:** `updateAccommodation`/`updateActivity` (`packages/api/src/accommodations.ts`/`activities.ts`) each carried a stale `as any` cast on `.update(...)` with a "TODO: remove after gen types — auto_close not in generated schema yet" comment — `auto_close` has been in the generated schema for a while (confirmed via this migration's fresh `gen types` run), so both casts were removed. Not a behavior change, purely a type-safety cleanup adjacent to the code this migration already touched.

---

## 2026-08-15 (same day) — Tab "has data" indicator RPC

**Why:** v1.31.0 adds a border around trip tab pills (Chat, Prework, Base, Transfer, Expenses, Activities, Stuff, Shopping, Notes) that already contain data, so a member who joins an existing trip can tell at a glance which tabs are worth opening. Needed a single cheap existence check per tab rather than N separate list-count queries fired on every trip-screen mount.

**Migration `20260815110000_get_trip_tab_content.sql`:**
```sql
CREATE OR REPLACE FUNCTION public.get_trip_tab_content(p_trip_id UUID)
RETURNS TABLE(chat BOOLEAN, prework BOOLEAN, base BOOLEAN, transfer BOOLEAN,
              expenses BOOLEAN, activities BOOLEAN, stuff BOOLEAN, shopping BOOLEAN, notes BOOLEAN)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
...
```
Guarded with the standard `auth.uid() IS NULL` / `private.is_trip_member(p_trip_id, auth.uid())` checks, then one `EXISTS(...)` per flag.

**`SECURITY INVOKER`, not this repo's usual `SECURITY DEFINER` RPC convention — deliberate.** Two source tables have per-caller row visibility that a DEFINER function would silently widen: `packing_items` (SELECT policy `user_id = auth.uid()`, private per user) and `lost_found_cases` (SELECT policy `created_by = auth.uid() OR target_user = auth.uid() OR target_user IS NULL`). Running as INVOKER lets ordinary RLS scope every `EXISTS` to the caller, so the `stuff` flag correctly means "*I* have packing items or visible cases," not "someone on the trip does." `private.is_trip_member` is itself `SECURITY DEFINER` with no explicit `REVOKE`, so it remains callable from an INVOKER context exactly as it already is from every RLS policy that calls it.

**Predicate table** (each source table's delete/archive column differs; several have none — verified against every table's own migration, not assumed):

| Flag | Predicate |
|---|---|
| `chat` | `trip_messages` + `deleted_at IS NULL` (RLS deliberately does not filter this — soft-delete arrives as an UPDATE for realtime) |
| `prework` | `prework_topics` — no soft delete |
| `base` | `accommodations` + `deleted_at IS NULL` |
| `transfer` | `transfer_flights` ∪ `transfer_vehicles` ∪ `transfer_rentals`, each `deleted_at IS NULL` |
| `expenses` | `expenses` + `archived_at IS NULL` (no `deleted_at` on this table) |
| `activities` | `activities` + `deleted_at IS NULL` |
| `stuff` | `packing_items` `deleted_at IS NULL` ∪ `shared_packing_items` `deleted_at IS NULL` ∪ `lost_found_cases` (no soft delete) |
| `shopping` | `shopping_lists` `archived_at IS NULL` ∪ `shopping_items` `deleted_at IS NULL` ∪ `recipes` (no soft delete) |
| `notes` | `trip_notes` — hard delete only, no filter |

**Dev push:** applied cleanly; `gen types --linked` confirms the RPC signature (`Args: { p_trip_id: string }`, 9-boolean row type) matches exactly.

**Prod push:** new function only, no schema/data change, `SECURITY INVOKER` means it can only ever see what the calling user's own RLS already allows — meets the standard "safe, backwards-compatible" bar, pushed immediately. Re-linked to dev afterward per the standard workflow.

**App-side:** `TripTabContent` type (`packages/types`), `getTripTabContent` in `packages/api/src/trips.ts`, `useTripTabContent` hook (`apps/mobile/src/features/trips/hooks/useTrips.ts`) — invalidated on tab change rather than polled, since only the active tab is ever mounted. Tab bar border in `apps/mobile/app/trip/[id]/index.tsx` uses `colors.textPrimary` (theme-aware: `#F2F2F2` dark / `#1A1A1A` light / `#690F0C` colorful), shown only on inactive, populated tabs.
