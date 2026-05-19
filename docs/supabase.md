# Supabase Changes Log

## Project Details
- **Project:** dev
- **Project ID:** aejywkbkcwyanhyzhrle
- **Region:** eu-west-3
- **Database:** PostgreSQL 17.6

---

## 2026-05-11 — Phase 2: Trips, Members, Invites

### Migration: `create_trips_members_invites`

Created three interdependent tables in a single migration (RLS policies cross-reference each other):

**Tables:**
- `public.trips` — Core trip entity with soft delete, date validation, status lifecycle
- `public.trip_members` — Membership join table with role enforcement (organizer/participant/guest)
- `public.invite_tokens` — Secure invite system with expiry, revocation, and usage limits

**RLS Policies:**
- `trips`: SELECT by members only (soft-deleted hidden), INSERT by any auth user, UPDATE by organizers only
- `trip_members`: SELECT by co-members, INSERT by self or organizer, UPDATE by organizer, DELETE by self or organizer
- `invite_tokens`: SELECT/INSERT/UPDATE by organizers only

**Triggers:**
- `on_trip_created` — auto-inserts trip creator as `organizer` in `trip_members`

**Functions:**
- `redeem_invite_token(token_value TEXT) RETURNS UUID` — SECURITY DEFINER function that validates token (not expired/revoked/over limit), atomically increments `use_count`, inserts user as `participant` or `guest` based on `users.is_guest`, returns `trip_id`. Uses `FOR UPDATE` row lock to prevent race conditions.

**Local migration file:** `supabase/migrations/20260511000002_create_trips_members_invites.sql`

---

## 2026-05-11 — Phase 2: Prevent Last Organizer Removal

### Migration: `prevent_last_organizer_removal`

Added two BEFORE triggers to prevent orphaning a trip without an organizer:

**Triggers:**
- `on_trip_member_delete` — BEFORE DELETE on `trip_members`: raises exception if the member being removed is the last organizer
- `on_trip_member_role_change` — BEFORE UPDATE OF role on `trip_members`: raises exception if demoting the last organizer

Both functions use `SECURITY DEFINER SET search_path = ''`.

**Local migration file:** `supabase/migrations/20260511000003_prevent_last_organizer_removal.sql`

---

## 2026-05-11 — Phase 2: Invite Rate Limiting & Tighten Self-Insert

### Migration: `invite_rate_limit_and_tighten_self_insert`

**Rate limiting:**
- Added `check_invite_rate_limit()` BEFORE INSERT trigger on `invite_tokens`
- Limits organizers to max 10 invite tokens per trip per hour
- Uses `SECURITY DEFINER SET search_path = ''`

**Tightened trip_members INSERT policy:**
- Dropped the permissive `trip_members_insert` policy (which allowed any authenticated user to insert themselves)
- Replaced with `trip_members_insert_organizer_or_system` — only organizers can directly insert members
- SECURITY DEFINER functions (`handle_new_trip`, `redeem_invite_token`) bypass RLS, so auto-insert on trip creation and invite redemption still work

**Local migration file:** `supabase/migrations/20260511000004_invite_rate_limit_and_tighten_self_insert.sql`

---

## 2026-05-12 — Fix: Infinite recursion in trip_members RLS policies

### Problem
Creating a trip (or any query touching `trips`, `trip_members`, or `invite_tokens`) failed with:
`infinite recursion detected in policy for relation "trip_members"`

### Root Cause
The `trip_members_select` RLS policy queried `trip_members` from within its own `USING` clause, creating infinite recursion. Every other policy on `trips` and `invite_tokens` that referenced `trip_members` cascaded into the same loop.

### Fix
1. Created `private` schema (not exposed via Data API) with `GRANT USAGE` to `authenticated`.
2. Created two SECURITY DEFINER helper functions:
   - `private.is_trip_member(p_trip_id UUID, p_user_id UUID)` — checks membership, bypasses RLS
   - `private.is_trip_organizer(p_trip_id UUID, p_user_id UUID)` — checks organizer role, bypasses RLS
3. Rewrote all 10 affected policies across `trips`, `trip_members`, and `invite_tokens` to call these helpers instead of querying `trip_members` directly.
4. Added `created_by = auth.uid()` fallback to `trips_select_member` SELECT policy — in PostgreSQL 17, `RETURNING` is subject to SELECT policies, but the AFTER INSERT trigger (`handle_new_trip`) fires after `RETURNING` evaluates, so `is_trip_member()` would fail for newly created trips. The `created_by` check lets the creator see the row immediately.

**Local migration file:** `supabase/migrations/20260512000001_fix_rls_infinite_recursion.sql`

---

## 2026-05-11 — Fix: Backfill public.users and harden trigger

### Problem
Google sign-in and magic link auth worked (rows created in `auth.users`), but no corresponding rows appeared in `public.users`. Users were authenticated but had no profile data.

### Root Cause
The migration `20260511000001_create_users_table.sql` (which creates `public.users`, the `handle_new_user()` trigger function, and the `on_auth_user_created` trigger) was applied **after** users had already signed up. The trigger only fires on `INSERT` into `auth.users`, so existing users were never backfilled.

### Changes Applied via MCP

**1. Backfilled existing auth.users into public.users**
```sql
INSERT INTO public.users (id, name, email, avatar_url, is_guest)
SELECT
  au.id,
  COALESCE(
    au.raw_user_meta_data ->> 'full_name',
    au.raw_user_meta_data ->> 'name',
    CASE WHEN au.is_anonymous THEN 'Guest' ELSE 'User' END
  ),
  au.email,
  au.raw_user_meta_data ->> 'avatar_url',
  COALESCE(au.is_anonymous, FALSE)
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;
```

**2. Updated `handle_new_user()` trigger function with ON CONFLICT**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url, is_guest)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      CASE WHEN NEW.is_anonymous THEN 'Guest' ELSE 'User' END
    ),
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(NEW.is_anonymous, FALSE)
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, public.users.name),
    email = COALESCE(EXCLUDED.email, public.users.email),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url);
  RETURN NEW;
END;
$$;
```

### Related Code Changes
- `packages/api/src/users.ts` — Added `ensureUserProfile(session)` client-side fallback
- `packages/api/src/index.ts` — Exported `ensureUserProfile`
- `apps/mobile/src/features/auth/hooks/useAuthInit.ts` — Replaced `getUserProfile` with `ensureUserProfile`
- `supabase/migrations/20260511000001_create_users_table.sql` — Updated trigger function with `ON CONFLICT`

---

## 2026-05-11 — Config: Custom SMTP via Resend

### Problem
Supabase's built-in SMTP has a rate limit of ~2 emails/hour and poor deliverability. Magic link emails were not being delivered reliably.

### Solution
Configured [Resend](https://resend.com) as a custom SMTP provider in Supabase Dashboard > Authentication > SMTP Settings.

### SMTP Configuration
| Setting       | Value                              |
|---------------|------------------------------------|
| Host          | `smtp.resend.com`                  |
| Port          | `465`                              |
| Username      | `resend`                           |
| Password      | Resend API key (stored in Dashboard) |
| Sender email  | `onboarding@resend.dev` (free tier) |
| Rate limit    | 30 emails/hour (up from 2)         |

### Known Limitation
Resend's free tier without a verified custom domain only allows sending emails to the Resend account owner's email address (`tdkiodok@gmail.com`). Sending to any other address returns:

```
550 You can only send testing emails to your own email address (tdkiodok@gmail.com).
To send emails to other recipients, please verify a domain at resend.com/domains.
```

**To resolve:** Verify a custom domain at [resend.com/domains](https://resend.com/domains), then update the sender email in Supabase SMTP settings to use that domain (e.g. `noreply@yourdomain.com`).

### Redirect URLs Configured
Added to Supabase Dashboard > Authentication > URL Configuration:
- `vacationist://` — production deep link scheme
- `exp://192.168.x.x:8081` — Expo dev server (local development)

---

## 2026-05-12 — Fix: Soft-delete trip RLS violation

### Problem
Calling `softDeleteTrip` failed with:
`42501: new row violates row-level security policy for table "trips"`

### Root Cause
PostgreSQL 16+ applies **SELECT policies as implicit WITH CHECK constraints on UPDATE**. The `trips_update_organizer` UPDATE policy's own `WITH CHECK` passed (organizer check → true), but PostgreSQL additionally requires the new row to satisfy the SELECT policy `trips_select_member`. That policy requires `deleted_at IS NULL`. After setting `deleted_at`, the new row fails this check — PostgreSQL rejects the UPDATE even though the organizer is authorized.

### Fix
Created `public.soft_delete_trip(p_trip_id UUID)` as a `SECURITY DEFINER` function. It bypasses RLS (runs as function owner), performs its own auth check (`auth.uid()` not null + `private.is_trip_organizer`), and then does the UPDATE directly.

Updated `packages/api/src/trips.ts` → `softDeleteTrip` now calls `supabase.rpc('soft_delete_trip', { p_trip_id })` instead of a direct UPDATE.

**Local migration file:** `supabase/migrations/20260512185430_fix_soft_delete_trip.sql`

---

## 2026-05-12 — Phase 3: Activities & Voting System

### Migration: `create_activities_and_votes`

**Tables:**
- `public.activities` — Activity planning per trip with soft delete, status lifecycle, voting flag
- `public.activity_votes` — Non-numeric voting (must_do/like/open/skip/group_blocker), UNIQUE on (activity_id, user_id) for upsert semantics

**RLS Policies:**
- `activities`: SELECT by trip members (non-deleted), INSERT by trip members (created_by = self), UPDATE by organizer or creator
- `activity_votes`: SELECT by trip members, INSERT/UPDATE/DELETE by own user + voting must be open

**Triggers:**
- `activities_updated_at` — auto-updates `updated_at` on UPDATE (reuses `set_updated_at()`)
- `on_activity_vote_inserted` — AFTER INSERT/UPDATE: auto-finalizes voting when all trip members have voted (sets `voting_open = FALSE`)

**Functions:**
- `public.soft_delete_activity(p_activity_id UUID)` — SECURITY DEFINER: organizer can delete any, participant can delete own, guest cannot delete
- `public.close_activity_voting(p_activity_id UUID)` — SECURITY DEFINER: only organizers can manually close voting

**Indexes:**
- `idx_activities_trip_id` (partial: deleted_at IS NULL)
- `idx_activities_created_by`
- `idx_activities_activity_date` (partial: deleted_at IS NULL)
- `idx_activity_votes_activity_id`
- `idx_activity_votes_user_id`

**Local migration file:** `supabase/migrations/20260512200000_create_activities_and_votes.sql`

---

## 2026-05-12 — Security: Restrict activity update fields

### Migration: `restrict_activity_update_fields`

Added `BEFORE UPDATE` trigger on `activities` that prevents non-organizers from modifying `voting_open` or `status` columns. Also prevents any user from changing `trip_id` or `created_by`.

**Why needed:** The `activities_update_member` RLS policy allows the activity creator (any role) to UPDATE the row. Without this trigger, a participant-creator could bypass the `close_activity_voting` RPC and directly set `voting_open = FALSE` or change status.

**Local migration file:** `supabase/migrations/20260512200001_restrict_activity_update_fields.sql`

---

## 2026-05-12 — Security: Enforce https:// URLs at DB level

### Migration: `enforce_https_urls`

Added CHECK constraints on `activities.external_url` and `activities.maps_url` requiring `https://` prefix. Prevents injection of `javascript:`, `data:`, or other unsafe URL schemes by clients bypassing Zod validation.

**Local migration file:** `supabase/migrations/20260512200002_enforce_https_urls.sql`

---

## 2026-05-12 — Enforce activity_date within trip date range

### Migration: `enforce_activity_date_within_trip`

Added BEFORE INSERT/UPDATE trigger on `activities` that validates `activity_date` falls between the parent trip's `start_date` and `end_date`. NULL `activity_date` is allowed (activity without a set date).

**Why needed:** Client-side Zod validation enforces the date range in `CreateActivitySheet`, but a direct API call could bypass it. The trigger provides defense in depth at the database level.

**Function:** `public.check_activity_date_within_trip()` — SECURITY DEFINER, looks up trip dates and raises exception if out of range.

**Local migration file:** `supabase/migrations/20260512220744_enforce_activity_date_within_trip.sql`

---

## 2026-05-12 — Extend soft_delete_trip to revoke invite tokens

### Change
Updated `public.soft_delete_trip(p_trip_id)` to also revoke all active invite tokens for the trip when it is soft-deleted.

**Why needed:** `invite_tokens.trip_id` has `ON DELETE CASCADE`, but that only fires on hard deletes. Since we never hard-delete trips, a soft-deleted trip's invite tokens would otherwise remain active and redeemable (though `redeem_invite_token` would fail at runtime because the user can't be added to a deleted trip, it is cleaner to revoke tokens explicitly).

**Change:** Added a second `UPDATE public.invite_tokens SET revoked_at = NOW() WHERE trip_id = p_trip_id AND revoked_at IS NULL;` inside the function body, executed after the trip soft-delete.

**Local migration file:** `supabase/migrations/20260512192444_revoke_tokens_on_trip_soft_delete.sql`

---

## 2026-05-13 — Phase 4a: Accommodations & Voting System

### Migration: `create_accommodations_and_votes`

**Tables:**
- `public.accommodations` — Accommodation suggestions per trip with soft delete, status lifecycle (suggested/requested/reserved/booked/completed), voting flag
- `public.accommodation_votes` — Non-numeric voting (must_do/like/open/skip/group_blocker), UNIQUE on (accommodation_id, user_id) for upsert semantics

**RLS Policies:**
- `accommodations`: SELECT by trip members (non-deleted), INSERT by trip members (created_by = self), UPDATE by organizer or creator
- `accommodation_votes`: SELECT by trip members, INSERT/UPDATE/DELETE by own user + voting must be open

**Triggers:**
- `accommodations_updated_at` — auto-updates `updated_at` on UPDATE
- `on_accommodation_update_restrict` — prevents non-organizers from modifying `voting_open` or `status`; prevents anyone from changing `trip_id` or `created_by`
- `on_accommodation_vote_inserted` — AFTER INSERT/UPDATE: auto-finalizes voting when all trip members have voted

**Functions:**
- `public.soft_delete_accommodation(p_accommodation_id UUID)` — SECURITY DEFINER: organizer can delete any, participant can delete own, guest cannot delete
- `public.close_accommodation_voting(p_accommodation_id UUID)` — SECURITY DEFINER: only organizers can manually close voting

**Constraints:**
- `accommodations_external_url_https` — CHECK constraint enforcing `https://` prefix on external URLs

**Indexes:**
- `idx_accommodations_trip_id` (partial: deleted_at IS NULL)
- `idx_accommodations_created_by`
- `idx_accommodation_votes_accommodation_id`
- `idx_accommodation_votes_user_id`

**Local migration file:** `supabase/migrations/20260513100000_create_accommodations_and_votes.sql`

---

## 2026-05-13 — Phase 4b: Expenses & Expense Splits

### Migration: `create_expenses_and_splits`

**Tables:**
- `public.expenses` — Shared cost tracking per trip with archive semantics (`archived_at`), related entity linking, currency enforcement (EUR/CHF)
- `public.expense_splits` — Per-member split amounts with settlement status tracking, UNIQUE on (expense_id, user_id)

**RLS Policies:**
- `expenses`: SELECT by trip members (non-archived), INSERT by trip members (created_by = self), UPDATE by organizer or creator
- `expense_splits`: SELECT by trip members via expense join, INSERT by expense creator or organizer

**Triggers:**
- `expenses_updated_at` — auto-updates `updated_at` on UPDATE
- `on_expense_update_restrict` — prevents changing `trip_id` or `created_by`

**Functions:**
- `public.archive_expense(p_expense_id UUID)` — SECURITY DEFINER: organizer can archive any, creator can archive own
- `public.settle_expense_split(p_split_id UUID)` — SECURITY DEFINER: payer, split owner, or organizer can mark as settled
- `public.unsettle_expense_split(p_split_id UUID)` — SECURITY DEFINER: same permissions, marks split back to open

**Indexes:**
- `idx_expenses_trip_id` (partial: archived_at IS NULL)
- `idx_expenses_paid_by`
- `idx_expenses_created_by`
- `idx_expense_splits_expense_id`
- `idx_expense_splits_user_id`
- `idx_expense_splits_status` (partial: status = 'open')

**Local migration file:** `supabase/migrations/20260513100001_create_expenses_and_splits.sql`

---

## 2026-05-13 — Atomic expense creation RPC

### Migration: `atomic_create_expense`

Replaced the two-step client-side expense+splits creation with a single SECURITY DEFINER RPC that inserts both atomically. Prevents orphaned expenses if split insertion fails.

**Function:**
- `public.create_expense_with_splits(p_trip_id, p_title, p_amount, p_currency, p_paid_by, p_related_type, p_related_id, p_split_user_ids UUID[]) RETURNS UUID` — validates auth + trip membership, inserts expense, calculates even splits with rounding correction on last member, inserts all splits, returns expense ID.

**Local migration file:** `supabase/migrations/20260513200000_atomic_create_expense.sql`

---

## 2026-05-13 — Fix: accommodation_votes UPDATE policy missing trip membership

### Migration: `fix_accommodation_votes_update_policy`

The `accommodation_votes_update_own` UPDATE policy's USING clause only checked `user_id = auth.uid()` but did not verify trip membership. A user removed from a trip could still update their existing vote. Fixed by adding `private.is_trip_member(a.trip_id, auth.uid())` to the USING clause.

**Local migration file:** `supabase/migrations/20260513200001_fix_accommodation_votes_update_policy.sql`

---

## 2026-05-13 — Fix: Auto-finalize accommodation voting blocked by restrict trigger

### Problem
When a non-organizer cast the last vote on an accommodation, the `auto_finalize_accommodation_voting` AFTER INSERT trigger attempted to set `voting_open = FALSE`. This fired the `restrict_accommodation_update_fields` BEFORE UPDATE trigger, which checked `private.is_trip_organizer(auth.uid())` — still the non-organizer — and raised `"Only organizers can change voting_open"`.

### Fix
Same pattern as the activity auto-finalize fix (`20260513000001`): added `pg_trigger_depth() > 1` early return to `restrict_accommodation_update_fields()`. When the update originates from a nested trigger (the auto-finalize function), permission checks are skipped. Direct client UPDATEs (depth = 1) still go through full validation.

**Local migration file:** `supabase/migrations/20260513200002_fix_accommodation_auto_finalize_permissions.sql`

---

## 2026-05-13 — Auto-settle expenses when all splits are settled

### Migration: `auto_settle_expense`

**Schema change:**
- Added `settled_at TIMESTAMPTZ DEFAULT NULL` to `public.expenses`

**Trigger:**
- `on_expense_split_status_change` — AFTER UPDATE OF status on `expense_splits`: when all splits for an expense are settled, sets `expenses.settled_at = NOW()`. When any split is reopened, clears `settled_at = NULL`.

**Function:**
- `public.auto_settle_expense()` — SECURITY DEFINER, counts total vs settled splits and toggles `settled_at` accordingly. Only writes when the value actually changes (avoids unnecessary updates).

**Local migration file:** `supabase/migrations/20260513200003_auto_settle_expense.sql`

---

## 2026-05-13 — Fix: Auto-settle payer's own split on expense creation

### Problem
When an expense was created, all splits (including the payer's) started as `status = 'open'`. The payer's split showing as unsettled made no sense — they already paid. This also caused the settlement badge to show "1/2" instead of "0/1" (the payer's split was counted as an ower).

### Fix
1. Updated `create_expense_with_splits()` to insert the payer's split with `status = 'settled'` automatically. If every split member is the payer (edge case), also sets `expenses.settled_at = NOW()` immediately.
2. Backfilled all existing payer splits to `status = 'settled'`.
3. Backfilled `expenses.settled_at` for any expenses where all splits are now settled.

### Related Code Changes
- `ExpenseCard` settlement badge now counts only ower splits (excludes payer's split) for the `X/Y` display.
- Expenses tab uses `SectionList` with "Active" and "Completed" sections based on `settled_at`.

**Local migration file:** `supabase/migrations/20260513200004_auto_settle_payer_split.sql`

---

## 2026-05-13 — Fix: Allow SELECT on archived expenses and splits

### Migrations: `allow_select_archived_expenses` & `allow_select_archived_expense_splits`

Updated RLS policies to allow trip members to SELECT archived expenses and their splits. Previously the partial index and SELECT policies filtered out `archived_at IS NOT NULL` rows, preventing the UI from showing them in the Archived section.

**Local migration files:**
- `supabase/migrations/20260513200005_allow_select_archived_expenses.sql`
- `supabase/migrations/20260513200006_allow_select_archived_expense_splits.sql`

---

## 2026-05-13 — Splitwise-like expense enhancements (flexible splits, editing, balances)

### Migration: `expense_split_methods`

**Schema changes:**
- Added `split_method TEXT NOT NULL DEFAULT 'even' CHECK (split_method IN ('even', 'exact', 'shares'))` to `public.expenses`
- Added `shares INT` column to `public.expense_splits` (used for shares-based splitting)

**Local migration file:** `supabase/migrations/20260513300000_expense_split_methods.sql`

---

### Migration: `flexible_expense_splits`

**Function (CREATE OR REPLACE):**
- `public.create_expense_with_splits(...)` — new overload accepting `p_split_method TEXT` and `p_splits JSONB` (array of `{user_id, amount?, shares?}`) instead of `p_split_user_ids UUID[]`
  - `even`: server-side calculated equal splits with rounding correction
  - `exact`: uses provided amounts per split, validates sum equals total
  - `shares`: uses provided integer shares to compute proportional amounts
  - Payer's split auto-settled; all-payer edge case sets `settled_at` immediately

**Local migration file:** `supabase/migrations/20260513300001_flexible_expense_splits.sql`

---

### Migration: `update_expense_with_splits`

**Function (new):**
- `public.update_expense_with_splits(p_expense_id UUID, p_title TEXT, p_amount NUMERIC, p_paid_by UUID, p_split_method TEXT, p_splits JSONB) RETURNS VOID` — SECURITY DEFINER
  - Validates auth: organizer or expense creator
  - Updates expense row (title, amount, paid_by, split_method)
  - Deletes existing splits and re-inserts new ones
  - Payer's split auto-settled, others reset to 'open'
  - Clears `settled_at` (re-evaluated by trigger)

**Local migration file:** `supabase/migrations/20260513300002_update_expense_with_splits.sql`

---

### Migration: `trip_balances`

**Function (new):**
- `public.get_trip_balances(p_trip_id UUID) RETURNS TABLE(user_id UUID, total_paid NUMERIC, total_owed NUMERIC, net_balance NUMERIC)` — SECURITY DEFINER
  - Computes per-member balances across non-archived expenses
  - `total_paid`: sum of `expenses.amount` where `paid_by = user_id`
  - `total_owed`: sum of `expense_splits.amount_owed` where `split.user_id = user_id`
  - `net_balance`: `total_paid - total_owed` (positive = others owe them)

**Local migration file:** `supabase/migrations/20260513300003_trip_balances.sql`

---

## 2026-05-14 — Expense System Architecture Hardening

### Migration: `20260514000001_expense_schema_hardening.sql`
- **Dropped** `expense_splits.shares` column (input mechanics only, not business truth)
- **Dropped** `expenses.settled_at` column + `auto_settle_expense()` trigger (settlement now derived from splits)
- **Added** `expenses.updated_by UUID REFERENCES users(id)` for edit audit trail

### Migration: `20260514000002_update_expense_rpcs.sql`
- **Dropped** dead UUID[] overload of `create_expense_with_splits`
- **Updated** `create_expense_with_splits` (JSONB): removed shares persistence, removed settled_at logic
- **Updated** `update_expense_with_splits`: removed shares persistence, removed settled_at logic, added `updated_by = auth.uid()`
- **Updated** `get_trip_balances`: added ROUND to 2 decimal places, zeroes net_balance below 0.01 threshold

### Migration: `20260514000003_expense_security_hardening.sql`
- **Updated** `create_expense_with_splits`: validates `paid_by` is a trip member, validates all split `user_id`s are trip members, caps splits at 50
- **Updated** `update_expense_with_splits`: same three security validations as create

### Migration: `20260514000004_settlement_aware_balances.sql`
- **Updated** `get_trip_balances`: settlement-aware balance computation
  - Added `settled_by_ower` CTE: credits owers who have settled their splits (+amount)
  - Added `settled_to_payer` CTE: debits payers who received settlements (-amount)
  - New formula: `net_balance = total_paid + settled_back - total_owed - received_settlements`
  - Zeroes net_balance where `ABS(net_balance) < 0.01` (residual threshold)

---

## 2026-05-14 — Phase 5a: Shopping Lists & Items

### Migration: `20260514100000_create_shopping_lists_and_items.sql`

**Tables:**
- `public.shopping_lists` — shopping lists per trip
- `public.shopping_items` — items within a shopping list with soft delete, position ordering, V1 statuses (open/bought)

**RLS Policies:**
- `shopping_lists`: SELECT by trip members, INSERT by trip members (created_by = self), UPDATE by organizer or list creator
- `shopping_items`: SELECT by trip members (non-deleted, via list → trip), INSERT by trip members, UPDATE by any trip member (status changes)

**Triggers:**
- `shopping_lists_updated_at` / `shopping_items_updated_at` — auto-updates `updated_at`
- `on_shopping_item_update_restrict` — prevents guests from changing title/quantity/unit/notes; prevents anyone from changing shopping_list_id/created_by

**Functions:**
- `public.soft_delete_shopping_item(p_item_id UUID)` — SECURITY DEFINER: organizer can delete any, participant can delete own, guest cannot delete
- `public.delete_shopping_list(p_list_id UUID)` — SECURITY DEFINER: organizer or list creator can hard-delete (cascades items)

**Indexes:**
- `idx_shopping_lists_trip_id` on `shopping_lists(trip_id)`
- `idx_shopping_items_list_id` on `shopping_items(shopping_list_id)` WHERE `deleted_at IS NULL`
- `idx_shopping_items_status` on `shopping_items(status)` WHERE `deleted_at IS NULL`

**Supabase Realtime:**
- `shopping_items` table added to `supabase_realtime` publication for live item status updates

**Local migration file:** `supabase/migrations/20260514100000_create_shopping_lists_and_items.sql`

### Migration: `20260514120000_add_shopping_list_archived_at.sql`

Adds `archived_at TIMESTAMPTZ DEFAULT NULL` column to `shopping_lists` for section grouping (Active / Completed / Archived). Existing UPDATE RLS policy already covers organizer/creator access.

**Local migration file:** `supabase/migrations/20260514120000_add_shopping_list_archived_at.sql`

### Migration: `20260514130000_reopen_voting_functions.sql`

Adds SECURITY DEFINER functions for re-opening voting on activities and accommodations (organizer only):
- `public.reopen_activity_voting(p_activity_id UUID)` — sets `voting_open = TRUE`
- `public.reopen_accommodation_voting(p_accommodation_id UUID)` — sets `voting_open = TRUE`

Both functions check authentication, entity existence, and organizer role.

**Local migration file:** `supabase/migrations/20260514130000_reopen_voting_functions.sql`

---

## 2026-05-18 — Phase 5b: Realtime Voting for Activities & Accommodations

### Migration: `20260518000001_add_voting_realtime_publication.sql`

Added vote tables and entity tables to Supabase Realtime publication for live vote updates across all trip members.

**Realtime publication additions:**
- `public.activity_votes` — live vote INSERT/UPDATE/DELETE events
- `public.accommodation_votes` — live vote INSERT/UPDATE/DELETE events
- `public.activities` — live entity UPDATE events (voting_open status changes, edits)
- `public.accommodations` — live entity UPDATE events (voting_open status changes, edits)

**REPLICA IDENTITY changes:**
- `public.activity_votes` → FULL (DELETE payloads include all columns, needed to identify which activity a deleted vote belonged to)
- `public.accommodation_votes` → FULL (same reason)

**Architecture:**
- One realtime channel per trip per feature (`activity-voting:{tripId}`, `accommodation-voting:{tripId}`)
- Each channel listens to both vote events (unfiltered, since vote tables lack `trip_id`) and entity UPDATE events (filtered by `trip_id`)
- Realtime callbacks update TanStack Query cache directly, following the same pattern as Phase 5a shopping items
- App foreground resume triggers resubscription + query invalidation for reconciliation

**Local migration file:** `supabase/migrations/20260518000001_add_voting_realtime_publication.sql`

---

## 2026-05-19 — Phase 5c: Realtime Expenses

### Migration: `20260519000001_add_expenses_realtime_publication.sql`

Added expense tables to Supabase Realtime publication for live expense updates across all trip members.

**Realtime publication additions:**
- `public.expenses` — live INSERT/UPDATE events (create, edit, archive)
- `public.expense_splits` — live INSERT/UPDATE/DELETE events (create, settle/unsettle, cascade from update RPC)

**REPLICA IDENTITY changes:**
- `public.expense_splits` → FULL (DELETE payloads include all columns, needed because `update_expense_with_splits` DELETEs and recreates splits — `expense_id` is needed for client-side trip filtering)

**Architecture:**
- One realtime channel per trip: `expenses:{tripId}:{uid}`
- `expenses` events use server-side filter `trip_id=eq.{tripId}`
- `expense_splits` events are unfiltered (no `trip_id` column) — client-side guard checks `expense_id` against cached trip expenses
- Uses **debounced invalidation** (300ms) instead of surgical `setQueryData` because RPCs produce event bursts (e.g., `update_expense_with_splits` fires 1 UPDATE + N DELETEs + N INSERTs)
- Invalidates `['trips', tripId, 'expenses']`, `['trips', tripId, 'balances']`, and specific `['expenses', expenseId, 'splits']`
- Follows voting-style Pattern B: exponential backoff, status callbacks, AppState foreground resubscription

**Local migration file:** `supabase/migrations/20260519000001_add_expenses_realtime_publication.sql`
