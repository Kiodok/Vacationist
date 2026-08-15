---
name: phase12-enhancements
description: Historical reference for Phase 12 — activity auto-complete, offline support (MMKV + TanStack persist), invite sharing via HTTPS deep link, iOS EAS build config, and light mode theming. Use for context on where these foundations were first introduced.
---

# Phase 12: app enhancements (complete)

Phase 12 completed 2026-05-24. Five enhancements implemented:

1. **Activity auto-complete** — `isAutoCompleted()` in `activities.tsx` moves past-scheduled activities to the Completed section client-side (no DB change).

2. **Offline support** — `react-native-mmkv` + `@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister` installed. `PersistQueryClientProvider` in `QueryProvider.tsx` (24h cache). `useOnlineManager` wires NetInfo to TanStack `onlineManager`. `OfflineBanner` shown when offline. Travel documents excluded from cache (`gcTime: 0`). This was later superseded/extended by the June 2026 offline overhaul — see [[offline-ux-patterns]].

3. **Invite links** — Changed from clipboard (`vacationist://join?token=...`) to native `Share.share()` with an HTTPS URL (`https://vacationist.app/join?token=...`). Added `docs/join.html` redirect page (tries the app deep link, falls back to Play Store). Added Android `intentFilters` for `vacationist.app/join` in `app.config.ts`. Deep link handler updated to parse both URL schemes.

4. **iOS EAS build** — `eas.json` has iOS config in all profiles: `development` (real device), `preview` (internal distribution, installable via link), `production` (store). Manual Apple Developer setup was still required before building at the time this shipped.

5. **Light mode** — CSS variables in `global.css` (`:root` = light, `.dark` = dark). Tailwind tokens updated to `rgb(var(--color-*))`. `themeStore.ts` (Zustand + MMKV persistence, `'dark' | 'light' | 'system'`). `ThemeController` in `_layout.tsx` calls `setColorScheme()`. Three-segment toggle (Light/System/Dark) on the profile tab. `useThemeColors()` hook exported from `@vacationist/ui` for dynamic imperative colors. Note: colorful mode and the full four-mode theming rules in CLAUDE.md were added later — this phase only covers the original dark/light/system split.

**Why:** User requested these 5 features for production readiness.

**How to apply:** NativeWind CSS variables are the theming approach; MMKV is available for any future persistence needs; iOS builds require Apple Developer account setup first.
