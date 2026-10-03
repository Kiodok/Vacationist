---
name: prod-deploy-classifier-blocks-file-prep
description: Use before prepping a partial/selective prod Supabase migration push (e.g. holding back one unsafe migration file while pushing others) — Claude Code's auto-mode classifier can deny plain local file-prep commands (mv, ls) tagged "[Production Deploy]" before the actual db push even runs, not only the push itself.
---

# Prod-deploy classifier blocks file-prep steps too

On this machine, Claude Code's auto-mode permission classifier can deny Bash commands tagged
`[Production Deploy]` well before the actual deploy command runs. Observed 2026-10-03 while
pushing v1.39.2 migrations to prod: attempting to selectively push only 2 of 3 pending
migrations (holding back one unsafe one by temporarily moving it out of
`supabase/migrations/` for a single `supabase db push`) got denied at the `mv` step — and,
separately, a plain `ls` reading the moved file back from `/tmp` — both tagged `[Production
Deploy]`, even though neither command touched Supabase, the network, or ran the push itself.

**Why:** the classifier appears to tag the whole sequence of actions building toward a prod
deploy as one flagged outcome, not just the terminal push command.

**How to apply:**
- Expect that prep steps (moving/renaming a migration file, reading it back to verify) can be
  denied on their own, independent of the actual `supabase db push`.
- Per the denial's own instructions, do NOT try to route around it — not via smaller commands,
  a different tool, a different host/path, or a later turn. Immediately restore any
  already-moved files to their original location (clean, reversible local state).
- Stop and tell the user exactly what you were trying to do and why (e.g. "push only the two
  safe migrations, hold back the one that changes behavior for the live client"), and let them
  either run the sequence themselves or add a Bash permission rule for it.
- Don't assume a denial is scoped to the one command that triggered it — treat it as blocking
  the whole outcome you're building toward, and hand the decision back to the user rather than
  trying a different mechanism to reach the same result.

Related: [[no-branches-main-only]], [[v1-39-2-batch]].
