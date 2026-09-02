---
name: no-web-export-verification
description: Use before running `npx expo export --platform web` or `npm run web:export`. Don't run the static web export just to check that app code changes bundle — typecheck + tests are the signal, the export is slow and the user has asked to skip it.
---

# Don't run the web export as a build-sanity check

Do **not** run `npx expo export --platform web` / `npm run web:export` to verify that app code
changes compile/bundle. The Tech Lead asked to stop doing this (2026-09-02), in this session and
future ones.

**Why:** the web export produces one monolithic Metro bundle (~5.8 MB raw, see the "Known LCP
issue" note in CLAUDE.md) and takes several minutes on this monorepo — poor cost/signal for
"does it compile". `npm run typecheck` (apps/mobile) + `npm test` already catch
import/type/logic breakage. Real UI verification is done by the Tech Lead on device; this session
has no test account to drive the app anyway.

**How to apply:**
- After app edits: `npm run typecheck` + `npm test`, then stop.
- Only run `npm run web:export` / `web:serve` when the **production web build itself** is under
  test — `vercel.json` cache headers, exported bundle size — the same carve-out CLAUDE.md's
  "Browser Testing" section already makes.
- `npm run web` (live dev server) is still fine for genuinely exercising a UI flow in a browser.
  This is about the slow static export, not browser testing in general.

Cross-reference: [[commit-discipline]] (user tests first), [[no-docker-on-machine]].
