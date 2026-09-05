---
name: no-branches-main-only
description: Use before any git branch / checkout -b / PR-based step in this repo, and when a change spans a DB migration plus client code. This repo does NOT use branches — all work is committed directly to `main`, which is production and auto-deploys web + the marketing site.
---

# No branches — everything goes to `main`

This repo does **not use git branches**. No feature branches, no PRs, no `git checkout -b`. All
work is committed directly onto `main`.

**Why:** `main` is production. Every push auto-deploys the web app to `web.vacationist.app`
(Vercel) and the marketing site via GitHub Pages. Branches create a gap between what's deployed
and what's been merged.

**How to apply:**
- Do the work on `main`. Never branch "to be safe" / "for isolation".
- [[commit-discipline]] still applies — stage, commit only when the Tech Lead says so.
- A DB migration + the client code that reads the new schema = **one commit**, landing together.
- If a migration must hit prod ahead of a full mobile app-store build, the **web client on
  `main` must be updated and pushed in the same step** — otherwise `web.vacationist.app` runs
  against a schema its code doesn't match.
- Don't leave `v1.34.x`-style branches lying around; delete them (local + `origin`).

**The incident that motivated this (2026-09-05):** v1.34.1's `is_my_flight` → `is_mine` RPC
rename + the v1.34.2 cost migrations were pushed to **prod** while their client code sat on
unmerged `v1.34.1` / `v1.34.2` branches. `web.vacationist.app` (serving `main` = v1.34.0) then
computed the Analytics "my share" against a schema its code no longer matched — every flight
showed €0, PT entries silently dropped. See [[v1-34-2-batch]].

Also in CLAUDE.md → "## Git Workflow". Related: [[commit-discipline]], [[v1-34-2-batch]].
