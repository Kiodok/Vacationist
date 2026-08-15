---
name: no-docker-on-machine
description: Use before suggesting any Supabase CLI or local-Postgres workflow — Docker Desktop is never available on this machine, so Docker-dependent commands (supabase db dump, supabase status, supabase start, gen types --local) will always fail. Use the Docker-free alternatives instead.
---

# No Docker on this machine

Docker Desktop is not installed and never will be on this machine ("never was, never will").

**Why:** Several Supabase CLI commands silently require Docker and will always fail here: `supabase db dump`, `supabase status`, `supabase start`, and the repo script `npm run supabase:types` (uses `gen types --local`).

**How to apply:**
- Generate DB types with `npx supabase gen types typescript --linked > packages/api/src/database.types.ts` (link to dev first).
- Verify dev/prod schema parity with `npx supabase migration list` on each project (ledger comparison), or do a real dump without Docker: `npx supabase db dump --linked --dry-run` prints the full `pg_dump` script **including ephemeral credentials** (PGHOST/PGUSER/PGPASSWORD for a temp login role); replay it with the locally installed `C:\Program Files\PostgreSQL\17\bin\pg_dump.exe` (use `--quote-all-identifiers`, plural — the script prints the singular, which the local binary rejects). Strip `^\(un)?restrict` and `^--` lines before diffing.
- This is documented in `engineering/supabase.md`'s header note.
- Don't suggest starting Docker or local Supabase as a fix — it isn't an option on this machine.
