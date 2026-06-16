# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Role & Process

You are the **Senior Fullstack Engineer** for Vacationist. The user is the Tech Lead and Product Manager. Architecture decisions come from the Tech Lead; implementation is your job. **Stop and ask** if a business rule or UX flow is undefined — never guess.

Source of truth files:
- `engineering/software_engineering_guide.md` — tech stack, schemas, naming conventions, business logic
- `engineering/implementation_guide.md` — phase roadmap and completion status
- `engineering/supabase.md` — Supabase change log (update it after every migration)

---

## Development Commands

All commands run from the **repo root** unless noted.

```bash
# Start the dev server (requires a development build on device)
npm start

# Type-check (must exit 0 before any release)
npm run typecheck

# Run all tests
npm test

# Run tests in watch mode (from apps/mobile)
cd apps/mobile && npm run test:watch

# Run a single test file
cd apps/mobile && npx vitest run src/features/expenses/utils/settlements.test.ts

# Generate Supabase TypeScript types from local DB
npm run supabase:types

# Link to dev Supabase and push migrations
npx supabase link --project-ref aejywkbkcwyanhyzhrle
npx supabase db push

# Link to prod Supabase and push migrations
npx supabase link --project-ref fsfsqghbejwvgxujoyne
npx supabase db push

# Web export and local preview
npm run web:export && npm run web:serve
```

---

## Monorepo Structure

npm workspaces. Packages are symlinked under `node_modules/@vacationist/`.

| Package | Workspace name | Purpose |
|---------|---------------|---------|
| `apps/mobile` | `@vacationist/mobile` | Expo Router app — all screens, features, navigation |
| `packages/api` | `@vacationist/api` | **Only place** that imports and uses the Supabase client; raw query functions organized by domain |
| `packages/types` | `@vacationist/types` | Shared TypeScript types + Zod schemas — single source of truth for data shapes |
| `packages/ui` | `@vacationist/ui` | NativeWind design tokens and primitive components |
| `packages/utils` | `@vacationist/utils` | dayjs setup (UTC + timezone plugins), formatters |
| `packages/i18n` | `@vacationist/i18n` | i18next translations (`en`/`de`), `useLocale()` hook |

---

## App Architecture

### Layer Build Order (mandatory for every feature)
```
DB migration → Types (@vacationist/types) → Service (@vacationist/api) → Hook (feature/hooks) → Component → Screen
```
Never build a higher layer before the layer below it is complete.

### State Management Boundary (strict — never mix)
- **TanStack Query** — all server data: trips, activities, expenses, votes, shopping lists, notifications
- **Zustand** — session user (id, name, avatar, role), UI state (active tab, sheet open/closed), toast queue, theme
- Never store server data in Zustand. Never fetch from DB in a Zustand action.

### Feature Structure (`apps/mobile/src/features/<feature>/`)
Each feature owns: `components/`, `hooks/`, `screens/`, `utils/`. Services live in `packages/api/src/`. Types live in `packages/types/src/`.

### Routing
Expo Router file-based routing in `apps/mobile/app/`. Route groups: `(auth)`, `(tabs)`, `trip/`, `activity/`, `expense/`.

### i18n Pattern
Translations live in `packages/i18n/src/locales/{en,de}/<namespace>.json`. Use the `useTranslation('<namespace>')` hook from `@vacationist/i18n`. Push notifications are sent via the Edge Function and **always use English** (server-side); in-app display uses the device locale. When adding UI text, add both `en` and `de` keys in the same PR.

---

## Critical Rules

### 🔴 Migration Immutability
- **NEVER edit a migration file after it has been pushed to any environment.** Create a new migration file instead.
- After every prod push, verify schema parity with a dump diff:
  ```bash
  npx supabase link --project-ref fsfsqghbejwvgxujoyne
  npx supabase db dump --linked --schema-only -f prod_schema.sql
  npx supabase link --project-ref aejywkbkcwyanhyzhrle
  npx supabase db dump --linked --schema-only -f dev_schema.sql
  diff dev_schema.sql prod_schema.sql
  ```

### 🔴 Realtime Subscriptions
Every `postgres_changes` subscription **must** include a `filter: 'trip_id=eq.${tripId}'` parameter. Never subscribe without a filter (global O(events × subscribers) load). The filter column must exist directly on the subscribed table — use denormalized `trip_id` columns (already present on `activity_votes`, `accommodation_votes`, `transfer_flight_votes`, `transfer_flight_passengers`, `transfer_vehicle_passengers`, `expense_splits`, `shopping_items`). Use deterministic channel names: `channel-type:${tripId}` — no random suffixes. Prefer `refetchInterval` on TanStack Query over realtime for overview/aggregate screens.

### 🟡 Tests Must Pass
Run `npm test` from the repo root after any change to utilities or business logic. Never leave the test suite red.

### Auth Pattern
Use `supabase.auth.getSession()` (local storage, synchronous) for reading `user.id` in mutation functions. Reserve `supabase.auth.getUser()` (server round-trip) for security-sensitive server validation.

### Soft Deletes
`trips`, `activities`, `accommodations`, `expenses`, `shopping_items` use `deleted_at TIMESTAMPTZ`. Always filter `WHERE deleted_at IS NULL`. Tables that do NOT soft-delete: `trip_members`, `votes`, `tour_activities`, `recipe_ingredients`, `trip_notes`, `activity_notes`.

### No `any` Types
TypeScript strict mode is always enabled. Use Zod for validation at all system boundaries.

### Pro Gating
Never add `is_pro` checks to RLS policies — all gating is application-layer only. Never delete data when Pro expires — hide it, never destroy it.

### 🟡 Theme & Design Modes
Every new component and screen **must be verified across all four modes**: `dark`, `light`, `system`, and `colorful`. Default theme for first-time users is **colorful on Android** and **dark on web**. Colorful is the most demanding mode — design for it first.

**Palette reference**

| Token | dark | light | colorful |
|-------|------|-------|----------|
| `background` | `#0F0F0F` | `#FFFFFF` | `#FDA444` |
| `surface` | `#1A1A1A` | `#F5F5F5` | `#FECE8A` |
| `primary` | `#6C63FF` | `#6C63FF` | `#8c6196` |
| `textPrimary` | `#FFFFFF` | `#111111` | `#690F0C` |

**Rules for every new component**

1. **Never hardcode colors** — use NativeWind tokens (`bg-surface`, `text-text-primary`, `border-border`) or `colors.*` / `useThemeColors()` from `@vacationist/ui`.
2. **Colorful: surface ≈ background** — `bg-surface` (`#FECE8A`) and `bg-background` (`#FDA444`) are close on web. Add `boxShadow: '0 1px 4px rgba(0,0,0,0.12)'` on web when `isColorful && Platform.OS === 'web'`.
3. **Colorful: white text on primary fails** — `bg-primary` (`#8c6196`) needs `colors.surface` (`#FECE8A`) text, not `#ffffff`. Use `theme === 'colorful' ? colors.surface : '#ffffff'` for any text/icon on a primary-coloured button or badge.
4. **Colorful: vote/status borders need boosting** — use brighter overrides: success `#00A864`, warning `#D4600A`, and increase `borderWidth` from 1 → 2.
5. **Use `useResolvedTheme()`** from `@vacationist/ui` whenever a component needs conditional colorful styling. Never read theme directly from the Zustand store in UI components.
6. **Flash prevention (web)** — if a new theme token is added to `global.css`, update the inline script in `app/+html.tsx` so the `<html>` class is set before React mounts.

**Checklist for new UI work**

- [ ] Tested in dark mode (Android or web `.dark` class)
- [ ] Tested in light mode
- [ ] Tested in colorful mode — cards visible? text contrast passing? borders legible?
- [ ] Web-specific `boxShadow` added for colorful card surfaces
- [ ] No hardcoded `'#ffffff'` or `'#000000'` in JSX styles

---

## Supabase Changes Workflow

After every migration cycle:
1. Apply migration to **dev** first: `npx supabase link --project-ref aejywkbkcwyanhyzhrle && npx supabase db push`
2. Evaluate if the migration is safe for prod (non-destructive, backwards-compatible)
3. If safe: apply to prod immediately, then re-link to dev
4. If not safe: inform the user with a clear explanation before proceeding
5. Update `engineering/supabase.md` with a log entry describing the migration

---

## Release Strategy

### Version Numbering (`app.config.ts`)
| Bump | When | Delivery |
|------|------|----------|
| PATCH `1.0.x` | Bug fixes, no native/plugin changes | OTA update |
| MINOR `1.x.0` | New features, UI, dependency upgrades | Full Play Store build |
| MAJOR `x.0.0` | Breaking architecture change | Full Play Store build |

Build number is managed by EAS remotely (`autoIncrement: true`) — never edit it manually.

### OTA Updates (expo-updates)
`runtimeVersion.policy: "fingerprint"` — OTA only delivers to builds with a matching native fingerprint.

```bash
eas update --branch production --message "fix: <description>"
eas update --branch preview --message "fix: <description>"
eas update:list --branch production --limit 5
```

**Use OTA for:** bug fixes, text/copy changes, non-native UI, TanStack Query tweaks.
**Full build required for:** new native modules, Expo plugin changes, SDK upgrades, `app.config.ts` plugin additions.

### Full Build Pipeline
```bash
npm run typecheck                        # must exit 0
eas build --profile preview --platform android   # test on device first
eas build --profile production --platform android
eas submit --profile production --platform android
```

### Pre-Release Checklist
- [ ] `npm run typecheck` exits 0
- [ ] Preview APK tested on a physical Android device
- [ ] Google Sign-In completes successfully
- [ ] Push notification delivered end-to-end (prod Supabase → device)
- [ ] Travel document encrypt → biometric unlock → decrypt works
- [ ] `version` bumped in `app.config.ts` for MINOR or MAJOR releases
- [ ] Web build passes: `npm run web:export`

### Play Store Rollout
| Stage | Rollout % | Hold | Promote when |
|-------|-----------|------|--------------|
| Initial | 10% | 24 h | Crash rate < 0.5% |
| Mid | 50% | 24 h | Crash rate still < 0.5% |
| Full | 100% | — | — |

**Halt immediately if:** Sentry crash rate > 1% of sessions, or Play Console ANR rate crosses Android Vitals "bad behaviour" threshold.

For confirmed PATCH hotfixes: skip staging, go straight to 100%.

### Web Deployment (Vercel)
Every push to `main` triggers an automatic production deployment to `web.vacationist.app`. Vercel config is in `vercel.json` — do not override in the dashboard.

---

## Key IDs & References

| Item | Value |
|------|-------|
| EAS project ID | `a1dc4172-7c41-4aa9-a44d-afb1a0088278` |
| Android package | `com.vacationist.mobile` |
| Supabase prod ref | `fsfsqghbejwvgxujoyne` |
| Supabase dev ref | `aejywkbkcwyanhyzhrle` |
| Web app | `https://web.vacationist.app` |
| OTA update URL | `https://u.expo.dev/a1dc4172-7c41-4aa9-a44d-afb1a0088278` |
| Play Store service account | `./play-store-service-account.json` |
| Privacy policy | `https://vacationist.app/privacy-policy.html` |
| Terms of service | `https://vacationist.app/terms-of-service.html` |
