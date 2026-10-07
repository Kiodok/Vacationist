---
name: migration-create-or-replace-latest-body
description: Use before writing any new migration that does CREATE OR REPLACE FUNCTION or DROP/CREATE POLICY against an existing function or policy name — find and start from the LATEST body across all migrations, never the first one you happen to have read.
---

This repo never edits a pushed migration file (Migration Immutability, CLAUDE.md) — every change
to an existing function or policy ships as a new migration that does `CREATE OR REPLACE FUNCTION`
(functions) or `DROP POLICY` + `CREATE POLICY` (policies). That means the function/policy body you
need to extend may have been redefined several times since it was first created, and you must
start from the truly latest version, not whichever one you read earlier in a research pass.

**Why:** while writing the v1.39.5 multiple-organizers migration, a first draft of
`delete_own_account()`'s `CREATE OR REPLACE` was built from the body in
`20260727130000_fix_delete_own_account_joined_at_and_chat.sql` (the file that happened to be open
in context from earlier research) instead of the real latest body, which was actually in
`20261003150000_activity_documents_and_toggle.sql`. Three migrations in between had each added a
new document-table reassignment step (`expense_documents`, `transfer_documents`,
`activity_documents`, `transfer_public_transport`). A naive `CREATE OR REPLACE` against the older
body would have silently reverted all of that — a real regression that would only surface much
later when a user who'd uploaded one of those document types tried to delete their account and hit
a foreign-key violation again (the exact bug class this function has been patched for repeatedly).

**How to apply:**
- Before writing `CREATE OR REPLACE FUNCTION public.<name>` or touching a named policy in a new
  migration, run `grep -l "CREATE OR REPLACE FUNCTION public.<name>"` (or the matching
  `CREATE POLICY "<name>"` pattern) across `supabase/migrations/*.sql`.
- Sort the hits by filename (they're timestamp-prefixed) and read the LAST one in full before
  writing anything — that is the current live definition, regardless of which file you read
  earlier in the session for unrelated context.
- Never assume a body read earlier in the same conversation is still current by the time you get
  to the edit — re-verify immediately before writing the `CREATE OR REPLACE`, even if it was "just
  five minutes ago."
- `delete_own_account()` specifically accumulates a new reassignment line almost every time a
  table with a non-cascading FK to `users` ships (see CLAUDE.md's Account Deletion section) — it
  is one of the functions most likely to have a newer body than whichever version you remember.
- A fast sanity check after drafting: diff your new function body against the latest-prior version
  with everything except your intended insertion stripped out — it should be byte-identical aside
  from that one change.

Related: [[v1-39-5-batch]], [[no-branches-main-only]].
