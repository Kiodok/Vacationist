---
name: prod-deploy-classifier-blocks-file-prep
description: Use before any prod Supabase migration push, or when a user says "you're now allowed" after a prior denial — Claude Code's auto-mode classifier can deny Bash commands tagged "[Production Deploy]" at a file-prep step OR at the actual db push itself, and a user's verbal permission in a later turn does not clear it.
---

# Prod-deploy classifier blocks file-prep steps — and the real push itself, even after permission is given

On this machine, Claude Code's auto-mode permission classifier can deny Bash commands tagged
`[Production Deploy]` at more than one point in a prod-migration workflow. Observed twice in one
day (2026-10-03) while pushing v1.39.2 migrations:

1. **File-prep step denied, not just the push.** Attempting to selectively push only 2 of 3
   pending migrations (holding back one unsafe one by temporarily moving it out of
   `supabase/migrations/` for a single `supabase db push`) got denied at the `mv` step — and,
   separately, a plain `ls` reading the moved file back from `/tmp` — both tagged `[Production
   Deploy]`, even though neither command touched Supabase, the network, or ran the push itself.
2. **The actual push denied too, later — even with the blocking precondition resolved.** Once
   the client that made the migrations safe was actually committed and pushed to `origin/main`
   (confirmed via `git show --name-only` + `git status -sb`, not assumed), a plain
   `npx supabase db push` against the prod-linked project was independently denied by the
   classifier as well — the real terminal command this time, no file-prep involved, no
   explanation given beyond "judged dangerous."

**Why:** the classifier appears to tag the whole sequence of actions building toward a prod
deploy as one flagged outcome, not just whichever single command triggers the check — and it can
re-flag that outcome later even after the condition that made it unsafe is gone.

**Critical: a user's verbal "you're allowed to do that now" in a later chat turn does NOT clear
this.** The denial text explicitly says not to pursue the same outcome "through ... a later
turn." Don't ask for confirmation and then retry the exact command on a yes — that is exactly the
pattern the denial prohibits. The only two valid paths through are: (a) hand the user the literal
commands to run themselves (`supabase link --project-ref <ref>` then `supabase db push`), or (b)
the user adds a Bash permission rule in their Claude Code settings. Nothing said in chat
substitutes for either.

**How to apply:**
- Expect that prep steps (moving/renaming a migration file, reading it back to verify) can be
  denied on their own, independent of the actual `supabase db push` — AND expect the push itself
  can be denied independently later, even after whatever made it unsafe is fixed.
- Per the denial's own instructions, do NOT try to route around it — not via smaller commands, a
  different tool, a different host/path, or a later turn (including one where the user just told
  you it's fine now). Immediately restore any already-moved files to their original location.
- Stop and tell the user exactly what you were trying to do and why, and give them the exact
  commands to run themselves, or point them at the Bash permission rule setting.
- After the user runs it themselves, your job shifts to **validation**: re-link the CLI
  read-only, check `supabase migration list` ledger parity (`local == remote`) on the relevant
  project(s), and where possible an independent check like `supabase gen types --linked` showing
  a new function/column actually present — don't just trust that the user's run succeeded without
  checking.

Related: [[no-branches-main-only]], [[v1-39-2-batch]].
