---
name: commit-discipline
description: Use before running any git commit in this repo — code must never be committed automatically after an edit; always stop and let the user test first, and only commit when they explicitly say to.
---

# Commit discipline

Do NOT commit code automatically after making changes. Always stop after code edits and wait for the user to test and explicitly say to commit.

**Why:** The user caught the assistant committing untested code twice in the same session. Committing before the user has validated a fix wastes git history and bypasses the review step.

**How to apply:** After any code edit, present what changed and stop. Only run `git commit` when the user explicitly asks (e.g. "commit it", "looks good, ship it"). This applies even when a task otherwise appears complete (tests pass, typecheck is clean) — completion of the code is not the same as user approval to commit.
