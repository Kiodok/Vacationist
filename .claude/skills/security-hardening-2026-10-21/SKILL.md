---
name: security-hardening-2026-10-21
description: Use before touching settle_all_expenses/settle_all_for_pair/settle_expense_split authorization, the public.users SELECT policy, create-example-trip's auth, or the expense/transfer/activity-documents storage RLS policies — a 2026-10-21 whole-app security review found and fixed real vulnerabilities in all four, and these fixes must not be regressed.
---

On 2026-10-21 a full-codebase (not diff-based) security review of Vacationist found and fixed 4 real, currently-exploitable vulnerabilities. All 4 are now live on dev AND prod.

## 1. `settle_all_expenses` / `settle_all_for_pair` — HIGH
Both RPCs only checked `private.is_trip_member`, letting any member (even a debtor) mark the whole trip's balances "settled" with zero creditor consent.

**Fix** (`supabase/migrations/20261021100000_harden_settle_all_authz.sql`):
- `settle_all_expenses(p_trip_id)` — settles every pair in the trip at once, so "caller is a party" doesn't apply. Restricted to **any trip organizer** (`private.is_trip_organizer`), matching `settle_expense_split`'s own organizer fallback.
- `settle_all_for_pair(p_trip_id, p_debtor, p_creditor)` — scoped to one pair, so it uses the exact `settle_expense_split` pattern: caller must be the debtor, the creditor, or an organizer. (Still unreachable from the app UI — no `packages/api` wrapper — kept rather than removed, per an earlier recorded decision.)

**Client change (same commit):** `apps/mobile/app/trip/[id]/expenses.tsx` added `canSettleAll = role === 'organizer'`, gating `onSettleAllExpenses` so `SettlementsModal`'s "Settle all" button disappears for non-organizers instead of raising a 403.

**Why:** A single authorization pattern (party-or-organizer, or organizer-only for trip-wide actions) must stay consistent across all expense-settlement RPCs. Don't reintroduce a membership-only check on any of them.

## 2. `public.users` SELECT policy — HIGH
Was `FOR SELECT TO authenticated USING (true)` — any authenticated session, including a disposable anonymous guest created via the `/join` screen's guest flow (reachable even without redeeming a valid invite token), could read every user's email address.

**Fix** (`supabase/migrations/20261021110000_narrow_users_select_policy.sql`): new `private.shares_trip_with(p_user_id UUID)` helper (same `SECURITY DEFINER SET search_path = '' STABLE` shape as `is_trip_member`/`is_trip_organizer`); policy narrowed to `id = auth.uid() OR id = '00000000-0000-0000-0000-000000000000'::uuid OR private.shares_trip_with(id)`.

**Why the sentinel carve-out matters:** `packages/api/src/expenses.ts`'s `payer:users!paid_by(...)` / `split_user:users!user_id(...)` embeds resolve the "Deleted User" sentinel row for expenses involving a deleted account (see `deleted-member-expense-split` skill) — that row has no `trip_members` row at all, so without the explicit carve-out this narrowing would regress deleted-member display back to "Unknown".

**How to apply:** Before adding any new feature that looks up another user's profile, confirm whether the target is guaranteed to be a co-trip-member. If not, it needs either a `SECURITY DEFINER` RPC (bypasses RLS, revalidate the caller's real need inside the function) or an extension to `shares_trip_with`'s disjuncts — never widen the raw policy back toward `USING (true)`.

## 3. `create-example-trip` Edge Function — MEDIUM
Deployed with `--no-verify-jwt`; the function itself did zero caller authentication, trusting a client-supplied `user_id` straight from the request body. Any internet caller could POST an arbitrary `user_id` and seed a fake demo trip (fake expenses, fake chat messages) onto a victim's account.

**Fix:**
- `supabase/functions/create-example-trip/index.ts` — added the same `constantTimeEqual` helper used in `push-notification/index.ts`, and a guard requiring `Authorization: Bearer <CREATE_EXAMPLE_TRIP_SECRET>` before reading `user_id` from the body.
- `supabase/migrations/20261021120000_require_secret_for_example_trip_trigger.sql` — `private.trigger_create_example_trip()` now reads a new vault secret `example_trip_secret` and sends it as the Bearer header to `net.http_post`, mirroring `private.trigger_fetch_exchange_rates()`.
- New vault secret `example_trip_secret` + new Edge Function secret `CREATE_EXAMPLE_TRIP_SECRET` exist on both dev and prod, **with different values per environment** (house convention — see `engineering/supabase.md`).

**Rollout order that avoids any gap:** create the secret (both places) → push the migration (trigger starts sending the header; the still-old function version ignores it harmlessly) → redeploy the function (now enforces it). Reversing the last two steps would cause new sign-ups to silently get no demo trip until the migration lands.

**Why:** any Edge Function deployed with `--no-verify-jwt` that isn't gated by its own shared-secret or `auth.getUser(jwt)` check is a fully public, unauthenticated HTTP endpoint — `supabase/config.toml` not listing a function under `verify_jwt = false` does NOT mean it's protected; check the actual deploy flags/history (a migration comment or `engineering/supabase.md` entry) before assuming `verify_jwt` default behavior applies.

## 4. Document storage RLS — MEDIUM
The self-upload branch of the INSERT/UPDATE/DELETE policies for `expense-documents`, `transfer-documents`, and `activity-documents` checked only that the leaf user-id path segment (`[4]`) matched `auth.uid()` — never that the trip-id segment (`[1]`) was a trip the caller actually belongs to. Any authenticated user could write an object into an arbitrary trip's storage namespace.

**Fix** (`supabase/migrations/20261021130000_require_trip_membership_on_document_storage.sql`): added `private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid())` as an additional `AND` on all 9 policies (3 buckets × INSERT/UPDATE/DELETE; SELECT already had this check). First migration in this repo to `DROP POLICY`/recreate a `storage.objects` policy — always qualify `ON storage.objects` explicitly, since same-named table-level policies also exist on the matching `public.*_documents` tables in the same original migration files.

**How to apply:** Any NEW storage bucket using the `{trip_id}/.../{user_id}/{filename}` path convention must copy this corrected policy shape (self-branch ANDed with `is_trip_member` on segment `[1]`) from this fix — not the older pattern still visible in earlier git history for these three buckets.

## Verification pattern used (no Docker on this machine)
`npx supabase db query --linked "<sql>"` against each linked project was used to both create vault secrets (`vault.create_secret(...)`, never direct `INSERT`) and to read back live function bodies (`SELECT prosrc FROM pg_proc WHERE proname = '...'`) / policy expressions (`SELECT pg_get_expr(polqual, polrelid) FROM pg_policy WHERE polrelid = '...'::regclass`) to confirm each fix was actually deployed as written, on both dev and prod. A direct `curl` against the Edge Function's public URL (unauthenticated → expect 401; with the correct secret → expect it to pass the gate, confirmed via a deliberately-invalid `user_id` that fails cleanly on a FK constraint rather than risking a real write) confirmed fix 3 end-to-end without needing a real sign-up.

See also: [[no-docker-on-machine]], [[migration-create-or-replace-latest-body]], [[deleted-member-expense-split]], [[no-branches-main-only]].
