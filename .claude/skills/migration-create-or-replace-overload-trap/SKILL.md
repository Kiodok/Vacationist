---
name: migration-create-or-replace-overload-trap
description: Use before writing or reviewing any migration that adds a parameter to an existing function via CREATE OR REPLACE FUNCTION — Postgres does not replace a function whose argument types changed, it silently creates a second overload instead, which can break the live (not-yet-updated) client with a silent, hard-to-diagnose failure. Caused a real prod incident 2026-10-15.
---

`CREATE OR REPLACE FUNCTION` only replaces a function in place when the argument **types** match
the existing definition exactly. Adding a new parameter — even a trailing, `DEFAULT`-valued one
that looks purely additive — changes the type list, so Postgres does **not** replace anything: it
silently creates a **second overload**, leaving the original signature live and callable alongside
the new one.

**Why:** when both overloads exist, a caller that doesn't supply the new parameter (the
currently-live, not-yet-shipped-with-the-update client) makes PostgREST unable to disambiguate
which overload to call. PostgREST rejects the request at the API-gateway layer — before it ever
reaches Postgres. That error is `PGRST*`-coded, which this codebase's `isExpectedMutationError`
(`apps/mobile/src/utils/errorClassification.ts`) already treats as "expected" (Sentry breadcrumb
only, never a captured exception) — so the failure produces **no Postgres log entry, no Sentry
issue, no console output, no network-layer error**. It just silently fails. This broke expense
create/edit on prod for about a day (2026-10-14 → 2026-10-15) after
`20261014100000_expense_created_at_editable.sql` added `p_created_at` this way. Full incident
writeup: `engineering/supabase.md`'s 2026-10-15 entry, and the `v1-39-6-batch` skill.

The same trap already hit this codebase once before: `book_transfer_flight`
(`20260905150000_add_return_flight_number.sql`) needed a same-day follow-up
(`20260905180000_drop_old_book_transfer_flight_overload.sql`) to drop the stale overload. That
precedent existed in the same migrations directory and wasn't checked before repeating the mistake.

**How to apply:**
- Any migration adding a parameter to an existing function via `CREATE OR REPLACE FUNCTION` is
  incomplete unless it **also** explicitly `DROP FUNCTION name(old, exact, type, list);` for the
  old signature, in the same migration — never rely on `CREATE OR REPLACE` alone once the parameter
  list changes, regardless of how backward-compatible the new parameter looks.
- Before ever pushing such a migration to prod: run `npm run supabase:types` and grep the function
  name in `packages/api/src/database.types.ts`. A single `: { Args: …, Returns: … }` object means a
  clean replace. A union (`: | { … } | { … }`) means a stale overload still exists on that
  environment — fix it before prod, not after. Check this for EVERY function the migration touches,
  not just the one that triggered a bug report.
- `supabase db push` applies every pending migration for the linked project, not a chosen subset.
  Before pushing an urgent fix, run `supabase migration list` and check the full pending set —
  pushing one migration can sweep in other pending-but-intentionally-held-back ones too.
- When dev and prod must intentionally diverge (e.g. prod reverted, dev keeps a feature mid-flight),
  use `supabase migration repair <version> --status applied --linked` to mark a migration "done" in
  one environment's ledger without executing its SQL there, so a later `db push` doesn't re-sweep it
  into the environment where it shouldn't run.
- **Migration ledgers are append-only execution logs, not current-effective-schema trackers.**
  `supabase migration list` tells you what hasn't *executed* yet on that environment — not what
  schema state is actually in effect right now. A migration that ran once and was later reverted by
  a follow-up migration still shows as "applied" forever; it will never show up as "pending" again,
  and `db push` will never re-run it. To know what's actually live, regenerate types
  (`npm run supabase:types`) and read `database.types.ts` directly — don't infer current state from
  the migration ledger alone.

See also [[migration-create-or-replace-latest-body]] — a related but distinct rule (always extend
the LATEST body of a function, not a stale one you happened to read first). This skill is about a
different failure mode: even extending the correct latest body can still create a silent duplicate
overload if the signature's argument types change.
