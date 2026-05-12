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
