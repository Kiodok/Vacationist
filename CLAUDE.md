# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Role & Process

You are the **Senior Fullstack Engineer** for Vacationist. The user is the Tech Lead and Product Manager. Architecture decisions come from the Tech Lead; implementation is your job. **Stop and ask** if a business rule or UX flow is undefined — never guess.

Source of truth files:
- `engineering/software_engineering_guide.md` — tech stack, schemas, naming conventions, business logic
- `engineering/implementation_guide.md` — phase roadmap and completion status
- `engineering/supabase.md` — Supabase change log (update it after every migration)

### Errors & Issues Found During Work
When you encounter errors or issues that were **not introduced by the current session** (pre-existing type errors, failing tests, broken imports, lint violations, etc.), **always fix them and explain what you found** — do not leave them in place just because they predate the current task. Briefly tell the user: what the issue was, why it existed, and what you did to fix it.

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

# Run a single test file (pure business logic tests live in packages/utils, not apps/mobile)
cd packages/utils && npx vitest run src/settlements.test.ts

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

## Browser Testing

Claude Code has access to a real Chrome browser via the `claude-in-chrome` skill (Load with the Skill tool if the `mcp__claude-in-chrome__*` tools aren't already loaded). Use it for local UI verification instead of guessing from code alone — e.g. serving `docs/` and clicking through the consent-banner flow, watching `read_network_requests` to confirm a pixel/tracking script only fires after opt-in, or exercising `web.vacationist.app` end to end. This is the concrete mechanism for the "start the dev server and use the feature in a browser before reporting complete" rule above — don't skip it for UI/frontend changes just because no browser tool was explicitly requested.

Known quirk: the extension's network-request capture occasionally mis-reports a `503` for `keepalive: true` beacon-style POSTs (observed identically on Google Analytics' own long-established endpoint during Phase 14 testing) — treat that specific pattern as a capture artifact, not a real server error, and cross-check with a direct `curl` before concluding a beacon endpoint is actually broken.

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

### 🔴 Cloudflare — No Cost-Incurring Actions
Claude Code has authenticated Cloudflare MCP access (API, Bindings, Builds, Observability — `vacationist.app` zone) for DNS records, Transform Rules, and SSL/TLS settings on the marketing site. **Never take any action that could incur cost or move the account/zone off its current (free) plan** — this includes but is not limited to: upgrading a zone plan, enabling paid add-ons (Bot Management, Advanced Rate Limiting, Load Balancing, Argo, paid WAF rule packs beyond the free managed ruleset), purchasing or transferring domains, creating billable Workers/Pages usage beyond free-tier limits, or provisioning any paid product (R2, D1, paid KV tiers, etc.). Stick to genuinely free-tier operations: DNS record management, proxy on/off toggling, free-tier Transform Rules, and Edge Certificate/SSL settings (HSTS, encryption mode) on the existing free plan. **If it's unclear whether an action has a cost implication, stop and ask the Tech Lead before proceeding** — do not assume free-tier based on documentation alone, since Cloudflare's free-tier limits change and vary by feature.

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
4. **Colorful: vote/status borders need boosting** — success border: `#00A864` (hardcoded, brighter than `colors.success`); negative/warning vote border: `colors.danger` (red, not orange — keeps it distinct from the orange default `colors.border`); `group_blocker` border: `colors.danger`. Increase `borderWidth` from 1 → 2.
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

## First-Launch Tutorial

The tutorial is a 5-slide fullscreen modal shown once to every new user. Slides and copy live in `packages/i18n/src/locales/{en,de}/tutorial.json`. The modal component is `apps/mobile/src/features/tutorial/components/TutorialModal.tsx`. It is mounted in `apps/mobile/app/(tabs)/_layout.tsx`.

**When adding a major feature:** Update both `tutorial.json` locale files to reflect it (add, update, or replace a slide). Keep the slide count at 5 — repurpose an existing slide rather than adding a sixth. Bump the MMKV key in `apps/mobile/src/features/tutorial/hooks/useTutorialSeen.ts` from `tutorial_seen_v1` → `tutorial_seen_v2` (etc.) so existing users see the updated tutorial once.

---

## Example Trip for New Users

Every new non-guest user automatically gets a pre-populated demo trip via the `create-example-trip` Edge Function (`supabase/functions/create-example-trip/index.ts`). It is triggered by the `trg_create_example_trip` AFTER INSERT trigger on `public.users`.

**When adding a new feature that creates new entity types:** Update the edge function to include a representative example of the new entity in the demo trip so new users can explore it. The guard at the top of the function (`count > 0`) prevents re-creation for existing users; it is safe to update example content at any time — only new sign-ups will see it.

---

## Account Deletion (`delete_own_account`)

`public.delete_own_account()` (`supabase/migrations/20260707110000_fix_delete_own_account_cascade.sql`, most recently patched by `20260727130000_fix_delete_own_account_joined_at_and_chat.sql`) anonymizes a user's content by reassigning every non-cascading FK to `public.users` over to the sentinel `00000000-0000-0000-0000-000000000000` ("Deleted User") before deleting the `auth.users` row.

**When adding a new table with a `created_by` / `paid_by` / `user_id` (etc.) FK to `public.users` that is NOT `ON DELETE CASCADE`:** add a reassignment line for it to `delete_own_account()` in the same migration. Missing this blocks account deletion with a foreign-key violation for any user who has a row in that table — this exact gap is what happened when `trip_messages` shipped without a matching update (fixed 2026-07-27, see `engineering/supabase.md`). To check for gaps, run the query in that log entry's migration verification section against `pg_constraint`.

**The retention behaviour of this function (what's destroyed vs. anonymized-and-kept) is documented for end users at `docs/delete-account.html` / `marketing/site/content/de/legal/delete-account.md`, and referenced from `docs/privacy-policy.html` §7.** Google Play requires this page's URL in the Play Console Data Safety "account deletion" field (see `engineering/play_data_safety.md`). If the sentinel-reassignment list in `delete_own_account()` changes — a new table added, or a table moved from "kept, anonymized" to "deleted" or vice versa — update both docs pages (EN + DE) in the same PR so the disclosure stays accurate.

---

## Marketing Site (docs/ — vacationist.app)

GitHub Pages serves `docs/` directly (no CI). SEO pages are **generated** — never edit generated HTML by hand.

### 🔴 Source of truth vs. generated output

| Edit this | To change | Then |
|-----------|-----------|------|
| `docs/index.html` | English landing page (hand-authored) | `npm run build:site` (regenerates `/de/`) |
| `docs/i18n/en.js` + `de.js` | All landing-page copy, both languages | Bump `CACHE_VER` in `docs/i18n.js` + `npm run build:site` |
| `marketing/site/content/**/*.md` | Blog, `/vs/`, `/alternatives/`, `/features/`, `/de/legal/` (Impressum, Datenschutz, AGB), `/de/alternatives/` pages | `npm run build:site` |
| `marketing/site/site.css` | Styling of all generated pages | `npm run build:site` |
| `marketing/site/build.mjs` | Templates, nav/footer links, sitemap, `/de/` transform | `npm run build:site` |
| `marketing/site/consent.js` | Cookie-consent banner + GA loader, all 43 pages (36 generated + 7 hand-authored) | `npm run build:site` (copies to `docs/assets/consent.js`) |
| `marketing/site/fonts/**` | Self-hosted Inter (variable, latin subset) | `npm run build:site` (copies to `docs/assets/fonts/`, via `copyFileSync` — never `writeOut`, which corrupts binaries) |

**NEVER hand-edit:** `docs/{vs,alternatives,blog,features,de,assets}/**` and `docs/sitemap.xml` — all build output, overwritten on every run. `docs/de/index.html` is generated by transforming `docs/index.html` with `de.js` translations (bump `DE_HOME_LASTMOD` in build.mjs on material changes). `docs/de/impressum/`, `docs/de/privacy-policy/`, `docs/de/terms-of-service/` are generated from `marketing/site/content/de/legal/*.md` — never edit them directly.

**Hand-authored pages carrying their own `<script defer src="/assets/consent.js">` (8, not 5 — easy to undercount):** `docs/index.html`, `docs/privacy-policy.html`, `docs/terms-of-service.html`, `docs/impressum.html`, `docs/delete-account.html`, `docs/404.html`, `docs/join.html`, `docs/scan/android-qr/index.html`. Any new hand-authored page needs the same `<script>` tag or it silently keeps loading nothing (fails closed) rather than gating GA correctly on that page.

**Cookie consent (`consent.js`):** Google Analytics (`G-4DRBWGQHE3`) is never requested until the visitor accepts via the banner — Consent Mode v2 defaults are pushed on every page before anything else loads. Banner copy lives inside `consent.js`'s `COPY` table, **not** in `docs/i18n/*.js` — generated pages never load `i18n.js`, and `renderGermanHome()` strips it from `/de/index.html`, so an in-script table is the only thing that reaches all 43 pages correctly localized. The re-open entry point is a plain `<a href="#cookie-settings">` link (in `FOOTER_LINKS` for generated pages, hand-added to the footer of hand-authored ones) — `consent.js` installs one delegated click handler, so no other wiring is needed.

**Security response headers (HSTS, X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy) are NOT configured anywhere in this repo.** GitHub Pages has no mechanism for custom response headers, so they are delivered at the Cloudflare edge on the `vacationist.app` zone (DNS is on Cloudflare, apex proxied): a Transform Rule (phase `http_response_headers_transform`) sets the four static headers, and HSTS is a zone-level Edge Certificate setting. The zone's built-in "Always Use HTTPS" toggle is deliberately left **off** — a custom Redirect Rule (phase `http_request_dynamic_redirect`) does the HTTP→HTTPS redirect instead, with an explicit exemption for `/.well-known/acme-challenge/*` so GitHub Pages' certificate renewal is never redirected. **Do not turn the built-in toggle on** — it would be redundant with the custom rule, not complementary. If a future audit reports headers missing, check the Cloudflare zone (via the dashboard or the authenticated Cloudflare MCP tools) before assuming a code fix is needed — see `engineering/supabase.md` (2026-08-06 entries) for exact ruleset/rule IDs and why the obvious API shapes (`always_use_https` on a Configuration Rule, action `set_response_headers`) don't actually exist.

### Rules

- **Bilingual copy:** every text change on the landing page needs both `en.js` and `de.js` keys (the hardcoded HTML is only the pre-JS fallback — keep it matching `en.js`). New elements get `data-i18n="key"` (`data-i18n-html` for markup, `data-i18n-href` for language-dependent links).
- **Language UX:** DE always before EN in switchers (DACH-first). `/de/` is static German; `/` is English with client-side swap; `?lang=en|de` overrides detection.
- **New blog post:** add a `.md` with front matter (`blogIndex: true` to list it on `/blog/`, plus `titleDe:` and `descriptionDe:` for its card on the German index `/de/blog/`), FAQ under `## Frequently asked questions` auto-becomes FAQPage JSON-LD, run build, add the URL to `docs/llms.txt` **as a Markdown link** (`- [Title](url): note`) under the `## Blog` section — a bare URL fails Lighthouse's Agentic Browsing audit ("file contains no links"). Article bodies are English; `/de/blog/` shows German cards with an "Englisch" badge.
- **New page pairs (EN↔DE):** set bidirectional `altPath` front matter — build validates and emits hreflang + sitemap alternates.
- **SEO title/description length:** `build.mjs`'s `loadPages()` warns (non-fatally) when a page's title exceeds 60 chars or description exceeds 160 — check build output for `[seo]` lines after editing front matter. It warns rather than throws because most existing pages already exceed these budgets (pre-existing debt, not a regression gate) — don't let the warning count block an unrelated build.
- **Verify:** run build **twice** (second run must produce zero git diff), then `npm run serve:docs` (port 3001) and click through `/`, `/de/`, `/blog/`.
- Deploy = commit + push to `main` (after user approval). Post-deploy: resubmit `sitemap.xml` in Search Console.

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

**`web.vacationist.app` is deliberately noindexed** (`public/robots.txt` full `Disallow: /`, `<meta name="robots" content="noindex, nofollow">` in `apps/mobile/app/+html.tsx`, `X-Robots-Tag` header in `vercel.json`) — it's the authenticated app, not a marketing surface; `vacationist.app` (GitHub Pages) is the sole SEO target. Don't add it back to any sitemap or loosen the robots rules without a Tech Lead call.

**Known LCP issue (unresolved):** the web export ships as one monolithic Metro bundle (~1.4MB Brotli-compressed, ~5.8MB raw) with no route-level code-splitting, despite `app.config.ts` already setting `web.output: 'static'`. Since this is a pure client-rendered SPA, LCP is fully gated on that bundle downloading + parsing + executing — this is the confirmed root cause of a ~10s LCP under throttled conditions. Fixing it requires verified research into Expo Router SDK 55's route-level lazy-bundling options (do not guess at Metro/Expo config flags — verify against current docs first) and isn't done yet. Immutable-asset caching (`/_expo/static/(.*)` → `max-age=31536000, immutable` in `vercel.json`) is already fixed and helps repeat visits, but not first-load LCP.

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