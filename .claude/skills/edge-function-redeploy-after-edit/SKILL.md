---
name: edge-function-redeploy-after-edit
description: Always redeploy a Supabase Edge Function immediately after editing its source, in the same turn — never batch it for "later" or assume a prior deploy in the session still covers a later edit.
---

# Redeploy an Edge Function in the same turn you edit it

Every edit to a Supabase Edge Function's source file must be followed by an explicit
`supabase functions deploy <slug>` to both dev and prod (per `CLAUDE.md`'s Supabase Changes
Workflow) in the SAME turn as the edit — never deferred, never assumed to be covered by an
earlier deploy of that same function from earlier in the session.

**Why:** caught 2026-09-05 during the v1.34.0 batch. `supabase/functions/push-notification/index.ts`
was edited twice in one session: once for the original Web Push feature build (deployed
immediately, correctly), and again later — in an unrelated `/code-review` fix pass — to wrap
`webPush.setVapidDetails()` in a try/catch. That second edit was never redeployed. Nothing in the
local workflow (`npm run typecheck`, `npm test`, `git status`) surfaces this gap: Edge Function
code isn't type-checked or tested locally the way `packages/*` is, and `git status` shows the file
as modified whether or not it was ever pushed to Supabase. The gap was only caught because the
Tech Lead explicitly asked "did you deploy everything?" A migration doesn't have this failure mode
in this project's workflow, because pushing to dev then prod is already a mandatory, reflexive
step immediately after writing a migration file — Edge Functions don't get the same treatment
simply because they're edited less often, and a mid-session touch-up (a bug fix found during
review, not the original feature build) is easy to mentally file as "just a code change" rather
than "a deploy is now owed."

## How to apply

- Treat an Edge Function edit exactly like a new migration for deployment purposes: the edit and
  the `supabase functions deploy` are one atomic unit of work, not two steps that can be split
  across time.
- This applies even to a one-line change made while fixing something unrelated (e.g., a
  code-review pass touching many files) — don't let a small Edge Function edit ride along
  unrecorded inside a larger batch of otherwise-local-only changes.
- When resuming or auditing a multi-file session's Supabase work, check each touched Edge
  Function's actual deployed `updated_at` (`supabase functions list` — timestamps are epoch ms)
  against when the file was last edited, rather than trusting an earlier "redeployed" note in
  memory/skill files — that note may only be true for an earlier edit to the same file, not the
  latest one.
- Concrete instance and fix: [[v1-34-0-batch]].
