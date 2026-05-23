# Supabase Changes Log

## Project Details
- **Project:** dev
- **Project ID:** aejywkbkcwyanhyzhrle
- **Region:** eu-west-3
- **Database:** PostgreSQL 17.6

---

## 2026-05-23 — Phase 8: Notifications

### Migration: `20260522213020_create_push_tokens`

**Why:** Store Expo push tokens per user/device so the Edge Function can deliver push notifications to the correct device. Tokens are upserted on login and deleted on logout — lifecycle managed in code to prevent ghost pushes.

**Table created:** `public.user_push_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID FK → users CASCADE | |
| `push_token` | TEXT | Expo push token |
| `platform` | TEXT | CHECK ('ios', 'android') |
| `created_at` | TIMESTAMPTZ | `DEFAULT NOW()` |
| `updated_at` | TIMESTAMPTZ | `DEFAULT NOW()`, trigger-maintained |
| UNIQUE | `(user_id, push_token)` | enables upsert semantics |

**RLS:** SELECT/INSERT/UPDATE/DELETE own rows only (`auth.uid() = user_id`).

**RPCs:**
- `upsert_push_token(p_push_token TEXT, p_platform TEXT)` — SECURITY DEFINER; upserts on `(user_id, push_token)` conflict, updates `updated_at`
- `delete_push_token(p_push_token TEXT)` — SECURITY DEFINER; deletes own token by value

---

### Migration: `20260522213020_create_notifications`

**Why:** Central store for all in-app notifications. Created by DB triggers (never by the client directly). Polled every 30 seconds by TanStack Query — no realtime channel needed.

**Table created:** `public.notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `trip_id` | UUID FK → trips CASCADE | |
| `user_id` | UUID FK → users CASCADE | recipient |
| `type` | TEXT | CHECK (8 types: `new_activity`, `vote_finalized`, `vote_update`, `expense_change`, `new_member`, `schedule_change`, `reminder`, `document_access_request`) |
| `title` | TEXT | |
| `body` | TEXT nullable | |
| `related_type` | TEXT nullable | entity type for deep linking (`activity`, `accommodation`) |
| `related_id` | UUID nullable | entity id for deep linking |
| `is_read` | BOOLEAN | `DEFAULT FALSE` |
| `push_sent_at` | TIMESTAMPTZ nullable | set by Edge Function on successful push delivery |
| `created_at` | TIMESTAMPTZ | `DEFAULT NOW()` |

**Indexes:** `(user_id, is_read, created_at DESC)`, `(trip_id, user_id, created_at DESC)`

**RLS:**
- SELECT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- INSERT: `WITH CHECK (false)` — all creates go through SECURITY DEFINER triggers
- DELETE: `auth.uid() = user_id`

**Trigger:** `restrict_notification_update_fields()` BEFORE UPDATE — raises exception if any column other than `is_read` or `push_sent_at` is modified.

**RPCs:**
- `mark_notification_read(p_notification_id UUID)` — SECURITY DEFINER; verifies ownership, sets `is_read = true`
- `mark_all_notifications_read(p_trip_id UUID DEFAULT NULL)` — SECURITY DEFINER; marks all unread for caller (optionally filtered by trip)
- `get_unread_notification_count(p_trip_id UUID DEFAULT NULL)` — SECURITY DEFINER STABLE; returns unread count for caller

---

### Migration: `20260522213021_create_notification_preferences`

**Why:** Control push delivery per trip per notification type. In-app notifications are always created; these flags determine whether the Edge Function actually sends a push. Rows are auto-created when a user joins a trip (all preferences default to `TRUE`).

**Table created:** `public.notification_preferences`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users CASCADE | |
| `trip_id` | UUID FK → trips CASCADE | |
| `new_activity` | BOOLEAN | `DEFAULT TRUE` |
| `vote_update` | BOOLEAN | `DEFAULT TRUE` |
| `expense_change` | BOOLEAN | `DEFAULT TRUE` |
| `new_member` | BOOLEAN | `DEFAULT TRUE` |
| `schedule_change` | BOOLEAN | `DEFAULT TRUE` |
| `reminder` | BOOLEAN | `DEFAULT TRUE` |
| UNIQUE | `(user_id, trip_id)` | |

**RLS:** SELECT/UPDATE own rows only. INSERT denied — created by trigger.

**Trigger:** `auto_create_notification_preferences()` SECURITY DEFINER AFTER INSERT on `trip_members` — inserts preference row with all defaults, `ON CONFLICT DO NOTHING`.

---

### Migration: `20260522213021_create_notification_helpers`

**Why:** Centralize the fan-out logic (one notification per trip member) in a single SECURITY DEFINER function so event triggers stay simple.

**Functions:**
- `private.create_trip_notification(p_trip_id, p_exclude_user_id, p_type, p_title, p_body, p_related_type, p_related_id)` — SECURITY DEFINER, `SET search_path = ''`; loops over `trip_members WHERE trip_id = p_trip_id AND user_id != p_exclude_user_id`; INSERTs one `notifications` row per member (each INSERT fires the push trigger)
- `send_organizer_nudge(p_trip_id UUID, p_title TEXT, p_body TEXT)` — SECURITY DEFINER; validates caller is organizer via `private.is_trip_organizer()`; rate-limits to 3 nudges per trip per hour; calls `private.create_trip_notification` with type `'reminder'`

---

### Migration: `20260522213022_create_notification_push_trigger`

**Why:** Deliver push notifications asynchronously without blocking the DB transaction. `pg_net` makes an HTTP POST to the Edge Function as a fire-and-forget call.

**Extension:** `CREATE EXTENSION IF NOT EXISTS pg_net`

**Vault secrets (stored via `vault.create_secret()`):**
- `push_notification_edge_fn_url` — deployed Edge Function URL
- `push_notification_service_role_key` — service_role key for Edge Function auth

**Trigger function:** `private.dispatch_push_notification()` — AFTER INSERT on `notifications` FOR EACH ROW, SECURITY DEFINER, `SET search_path = ''`
- Reads URL and key from `vault.decrypted_secrets`
- Calls `net.http_post(url, body, headers)` with the notification row serialized as JSON
- Fire-and-forget: the DB transaction does not wait for the HTTP response

**⚠️ Important:** After deploying the Edge Function, populate the vault secrets:
```sql
SELECT vault.create_secret('<edge-fn-url>', 'push_notification_edge_fn_url');
SELECT vault.create_secret('<service-role-key>', 'push_notification_service_role_key');
```

---

### Migration: `20260522213022_create_notification_event_triggers`

**Why:** Translate product events into notifications without any client involvement. All SECURITY DEFINER, `SET search_path = ''`.

| Trigger | Table | Event | Type | Exclude |
|---|---|---|---|---|
| `notify_new_activity` | `activities` | AFTER INSERT | `new_activity` | `NEW.created_by` |
| `notify_new_expense` | `expenses` | AFTER INSERT | `expense_change` | `NEW.created_by` |
| `notify_new_member` | `trip_members` | AFTER INSERT | `new_member` | `NEW.user_id` |
| `notify_activity_vote_finalized` | `activities` | AFTER UPDATE WHERE `OLD.voting_open AND NOT NEW.voting_open` | `vote_finalized` | nil (notify all) |
| `notify_accommodation_vote_finalized` | `accommodations` | AFTER UPDATE WHERE `OLD.voting_open AND NOT NEW.voting_open` | `vote_finalized` | nil (notify all) |
| `notify_schedule_change` | `activities` | AFTER UPDATE WHERE date/time changed | `schedule_change` | `auth.uid()` |
| `notify_document_access_request` | `document_access_requests` | AFTER INSERT | `document_access_request` | `NEW.requested_by` |

**Guard on `notify_schedule_change`:** `pg_trigger_depth() > 1` early return prevents cascade loops (e.g., when `notify_activity_vote_finalized` updates an activity, `notify_schedule_change` would otherwise fire too).

**`related_type` propagation:** `notify_activity_vote_finalized` sets `related_type = 'activity'`; `notify_accommodation_vote_finalized` sets `related_type = 'accommodation'` — used by `resolveNotificationPath` to route accommodation vote notifications to the Base tab vs. Activities tab.

---

### Edge Function: `supabase/functions/push-notification/index.ts`

Receives notification data from the `pg_net` trigger. Logic:

1. Auth: validates `Authorization: Bearer <service_role_key>` header
2. Checks `notification_preferences` for `(user_id, trip_id)`; maps type → preference column (`vote_finalized`/`vote_update` → `vote_update`; `document_access_request` → always-on)
3. Fetches `user_push_tokens` for user; if empty, returns 200 early
4. POSTs to `https://exp.host/--/api/v2/push/send` with `data: { notificationId, tripId, type, relatedType, relatedId }` for deep-link tap handling
5. On `DeviceNotRegistered` ticket: deletes stale token from `user_push_tokens`
6. Updates `push_sent_at` on success

**Not yet deployed** — run `supabase functions deploy push-notification`, then populate vault secrets (see above).

---

### Code changes (Phase 8)

**New files:**
- `supabase/migrations/20260522213020_create_push_tokens.sql`
- `supabase/migrations/20260522213020_create_notifications.sql`
- `supabase/migrations/20260522213021_create_notification_preferences.sql`
- `supabase/migrations/20260522213021_create_notification_helpers.sql`
- `supabase/migrations/20260522213022_create_notification_push_trigger.sql`
- `supabase/migrations/20260522213022_create_notification_event_triggers.sql`
- `supabase/functions/push-notification/index.ts`
- `packages/api/src/notifications.ts`, `packages/api/src/pushTokens.ts`
- `packages/types/src/notifications.ts` — `NUDGE_MESSAGES` constant
- `apps/mobile/src/features/notifications/hooks/` — `useNotifications.ts`, `useUnreadCount.ts`, `useNotificationPreferences.ts`, `useSendNudge.ts`, `usePushNotificationHandler.ts`
- `apps/mobile/src/features/notifications/utils/` — `registerForPushNotifications.ts`, `resolveNotificationPath.ts`
- `apps/mobile/src/features/notifications/components/` — `NotificationItem.tsx`, `EmptyNotifications.tsx`, `NotificationPreferencesSection.tsx`, `NudgeSheet.tsx`, `TripNotificationBell.tsx`
- `apps/mobile/app/(tabs)/notifications.tsx`
- `apps/mobile/app/trip/[id]/notifications.tsx`
- `apps/mobile/app/trip/[id]/overview.tsx` (OverviewTab; was `index.tsx`)

**Modified files:**
- `packages/types/src/enums.ts` — added `'document_access_request'` to `NOTIFICATION_TYPE`
- `packages/types/src/database.ts` — `UserPushToken` interface; `push_sent_at` on `Notification`
- `packages/types/src/schemas.ts` — `updateNotificationPreferencesSchema`
- `packages/types/src/index.ts` — exports `./notifications`
- `packages/api/src/database.types.ts` — regenerated from remote project
- `packages/api/src/index.ts` — exports notifications + pushTokens
- `apps/mobile/src/stores/authStore.ts` — `pushToken` state + `setPushToken` action
- `apps/mobile/src/features/auth/hooks/useSignOut.ts` — `deletePushToken` before `signOut`
- `apps/mobile/app/_layout.tsx` — push registration + notification handler setup
- `apps/mobile/app/(tabs)/_layout.tsx` — 4th Notifications tab + red badge
- `apps/mobile/app/trip/[id]/_layout.tsx` — replaced with `<Stack>`; custom trip UI moved to `index.tsx`
- `apps/mobile/app/trip/[id]/index.tsx` — now contains the full custom trip UI (formerly `_layout.tsx`)
- `apps/mobile/app/trip/[id]/settings.tsx` — `NotificationPreferencesSection` + `NudgeSheet`
- `apps/mobile/app.config.ts` — `expo-notifications` plugin

---

## 2026-05-25 — Phase 7e: Trip Notes

### Migration: `20260525000005_create_trip_notes`

**Why:** Trip members need a lightweight, shared notepad per trip — free-text notes with a title and optional description, visible to all members, editable by the author, deletable by the author or trip organizer.

**Table created:** `public.trip_notes`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `trip_id` | UUID FK → trips CASCADE | |
| `created_by` | UUID FK → users | |
| `title` | TEXT | `char_length <= 100` CHECK |
| `description` | TEXT nullable | `char_length <= 1000` CHECK |
| `created_at` | TIMESTAMPTZ | `DEFAULT NOW()` |
| `updated_at` | TIMESTAMPTZ | `DEFAULT NOW()`, maintained by trigger |

**Index:** `idx_trip_notes_trip_id ON trip_notes (trip_id)`

**RLS policies:**
- SELECT: `private.is_trip_member(trip_id, auth.uid())`
- INSERT: member + `created_by = auth.uid()`
- UPDATE: `created_by = auth.uid()` (creator only)
- DELETE: `created_by = auth.uid()` OR `private.is_trip_organizer(trip_id, auth.uid())`

**Triggers:**
- `trip_notes_updated_at` (BEFORE UPDATE) — calls `public.set_updated_at()`
- `on_trip_note_update_restrict` (BEFORE UPDATE) — `restrict_trip_note_update_fields()` raises exception if `trip_id` or `created_by` is changed

**No realtime publication** — notes are low-frequency, queries invalidate on mutation.

**No soft delete** — hard delete; no audit trail needed for notes content.

**Code changes:**
- `supabase/migrations/20260525000005_create_trip_notes.sql` — migration
- `packages/types/src/database.ts` — `TripNote` interface
- `packages/types/src/schemas.ts` — `createTripNoteSchema`, `updateTripNoteSchema`, `CreateTripNoteInput`, `UpdateTripNoteInput`
- `packages/api/src/notes.ts` — `getNotes`, `createNote`, `updateNote`, `deleteNote`
- `packages/api/src/index.ts` — exports for notes functions
- `apps/mobile/src/features/notes/hooks/useNotes.ts` — `useNotes`, `useCreateNote`, `useUpdateNote`, `useDeleteNote`
- `apps/mobile/src/features/notes/components/` — `EmptyNotes`, `NoteCard`, `CreateNoteSheet`, `EditNoteSheet`
- `apps/mobile/app/trip/[id]/notes.tsx` — Notes tab screen
- `apps/mobile/app/trip/[id]/_layout.tsx` — `'Notes'` tab registered between Recipes and Settings

---

## 2026-05-23 — Realtime Scaling: Denormalize `trip_id` to Child Tables

### Migration: `20260523000001_denormalize_trip_id_for_realtime_filters`

**Why:** Supabase Realtime `postgres_changes` subscriptions on child tables (votes, passengers,
splits, shopping items) had no `filter` parameter because those tables had no `trip_id` column.
Without a filter, Supabase delivers all events to all subscribers — O(events × subscribers) load.
This fixes the root cause by adding a denormalized `trip_id` to each child table.

**Tables modified (7):**

| Table | Parent FK | Backfill path |
|---|---|---|
| `activity_votes` | `activity_id` | `activities.trip_id` |
| `accommodation_votes` | `accommodation_id` | `accommodations.trip_id` |
| `transfer_flight_votes` | `flight_id` | `transfer_flights.trip_id` |
| `transfer_flight_passengers` | `flight_id` | `transfer_flights.trip_id` |
| `transfer_vehicle_passengers` | `vehicle_id` | `transfer_vehicles.trip_id` |
| `expense_splits` | `expense_id` | `expenses.trip_id` |
| `shopping_items` | `shopping_list_id` | `shopping_lists.trip_id` |

**Per table:** Added `trip_id UUID NOT NULL REFERENCES trips(id)`, backfilled existing rows,
created index on `trip_id`, added BEFORE INSERT trigger (`trg_set_{table}_trip_id`) that
auto-populates `trip_id` from the parent row — works correctly inside SECURITY DEFINER RPCs.

**Additional:**
- `shopping_items` set to `REPLICA IDENTITY FULL` (required for DELETE event payloads to include `trip_id`)
- `restrict_shopping_item_update_fields()` updated to also block `trip_id` mutation

**API layer changes:**
- Added `filter: trip_id=eq.${tripId}` to all previously-unfiltered realtime subscriptions in
  `activities.ts`, `accommodations.ts`, `expenses.ts`, `transferFlights.ts`, `transferVehicles.ts`, `shopping.ts`
- Replaced N-channel global calendar realtime (`useGlobalCalendarRealtime`) with `refetchInterval: 30_000`
  on `useGlobalCalendarActivities` — deleted `useGlobalCalendarRealtime.ts`

---

## 2026-05-24 — Trips Realtime: Propagate edits to all members

### Migration: `20260524000003_enable_trips_realtime`

Added `public.trips` to the Supabase Realtime publication so UPDATE events (title, description, dates, budget, timezone, currency) are delivered to all trip members in real time.

**Realtime publication addition:**
- `public.trips` — live UPDATE events

**REPLICA IDENTITY:** DEFAULT is sufficient — the subscription filter uses `id=eq.{tripId}` and `id` is the primary key, which is always present in the WAL record without FULL.

**Architecture:**
- One channel per trip: `trip-details:{tripId}` (mounted in the trip layout, active for all tabs)
- On UPDATE: surgically patches `['trips', tripId]` cache with `setQueryData`, preserving the joined `member_count` field; invalidates the top-level `['trips']` list so the home screen card stays in sync
- Follows standard exponential backoff reconnection [2s, 5s, 10s, 30s] and AppState foreground resubscription pattern

**Code changes:**
- `supabase/migrations/20260524000003_enable_trips_realtime.sql` — migration
- `packages/api/src/trips.ts` — added `subscribeToTripRealtime`, `unsubscribeFromTrip`, `TripRealtimeCallbacks`
- `packages/api/src/index.ts` — exported new symbols
- `apps/mobile/src/features/trips/hooks/useTripRealtime.ts` — new hook
- `apps/mobile/app/trip/[id]/_layout.tsx` — mounts `useTripRealtime(id!)`

---

## 2026-05-24 — Performance & Scaling: RLS Simplification, Indexes, Position Trigger, Count RPC

### Migration: `20260524000001_rls_indexes_position_trigger`

**Why:** Four child tables (`activity_votes`, `accommodation_votes`, `expense_splits`, `shopping_items`) had
RLS SELECT policies that JOINed back to the parent table to find `trip_id`. Now that these tables have a
denormalized `trip_id` directly (from the 2026-05-23 migration), the JOINs are unnecessary — this migration
rewrites those policies to use `private.is_trip_member(trip_id, auth.uid())` directly. Also adds composite
indexes for hot query paths and an atomic position trigger for shopping items.

**RLS policies rewritten (SELECT — eliminates parent JOIN):**
- `activity_votes`: removed JOIN to `activities`
- `accommodation_votes`: removed JOIN to `accommodations`
- `expense_splits`: removed JOIN to `expenses`
- `shopping_items`: removed JOIN to `shopping_lists` on SELECT, INSERT, and UPDATE

**Indexes added:**
- `idx_shopping_items_list_position ON shopping_items(shopping_list_id, position) WHERE deleted_at IS NULL`
- `idx_activities_trip_date ON activities(trip_id, activity_date) WHERE deleted_at IS NULL AND activity_date IS NOT NULL`
- `idx_expense_splits_expense_status ON expense_splits(expense_id, status)`

**Position trigger added:**
- `trg_set_shopping_item_position` (BEFORE INSERT) — atomically assigns `position = MAX(position)+1`
  within the transaction, eliminating the client-side SELECT-max + INSERT double round-trip and the
  associated race condition under concurrent inserts.

### Migration: `20260524000002_shopping_lists_count_fn`

**Why:** `getShoppingLists` previously fetched all item rows client-side just to count them. This RPC
computes `item_count` and `bought_count` server-side with SQL `COUNT ... FILTER`, returning one aggregated
row per list — no item rows transferred to the client.

**Function:** `get_shopping_lists_with_counts(p_trip_id UUID)` — SECURITY DEFINER, checks membership,
returns `shopping_lists` columns + `item_count BIGINT` + `bought_count BIGINT`.

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

---

## 2026-05-19 — Phase 6: Recipes & Ingredients

### Migration: `20260519100000_create_recipes_and_ingredients.sql`

**Tables:**
- `public.recipes` — Recipe management per trip (hard delete), with title, description, servings
- `public.recipe_ingredients` — Ingredients per recipe (hard delete via CASCADE), with quantity, unit, sort_order

**RLS Policies:**
- `recipes`: SELECT by trip members, INSERT by trip members (created_by = self), UPDATE by organizer or creator
- `recipe_ingredients`: SELECT/INSERT by trip members (via recipes join), UPDATE/DELETE by organizer or recipe creator

**Triggers:**
- `recipes_updated_at` — auto-updates `updated_at` on UPDATE (reuses `set_updated_at()`)
- `on_recipe_update_restrict` — prevents guests from editing recipes; prevents anyone from changing `trip_id` or `created_by`

**Functions:**
- `public.delete_recipe(p_recipe_id UUID)` — SECURITY DEFINER: organizer or recipe creator can hard-delete (cascades ingredients)

**FK Constraints:**
- `fk_shopping_items_source_recipe` on `shopping_items.source_recipe_id` → `recipes(id) ON DELETE SET NULL`
- `fk_shopping_items_source_ingredient` on `shopping_items.source_ingredient_id` → `recipe_ingredients(id) ON DELETE SET NULL`

**Columns added to shopping_items:**
- `source_ingredient_id UUID DEFAULT NULL` — tracks which recipe ingredient each shopping item was created from. Enables auto-propagation of ingredient add/update/delete to linked shopping lists. Only set on directly-created items (not merged duplicates).

**Indexes:**
- `idx_recipes_trip_id` on `recipes(trip_id)`
- `idx_recipe_ingredients_recipe_id` on `recipe_ingredients(recipe_id)`
- `idx_shopping_items_source_ingredient_id` on `shopping_items(source_ingredient_id) WHERE source_ingredient_id IS NOT NULL`

**Supabase Realtime:**
- `recipes` table added to `supabase_realtime` publication for live recipe CRUD updates
- `recipe_ingredients` table added to `supabase_realtime` publication for live ingredient changes (migration: `20260520100000_enable_realtime_recipe_ingredients.sql`)

**Functions:**
- `get_recipe_linked_lists(p_recipe_id UUID) RETURNS TABLE(shopping_list_id UUID)` — SECURITY DEFINER function that returns all distinct shopping list IDs a recipe has been added to, including lists where all items have been soft-deleted. Bypasses RLS to see soft-deleted rows that the SELECT policy would otherwise hide.

**Local migration files:**
- `supabase/migrations/20260519100000_create_recipes_and_ingredients.sql`
- `supabase/migrations/20260520100000_enable_realtime_recipe_ingredients.sql`
- `supabase/migrations/20260520110000_add_source_ingredient_id_to_shopping_items.sql`
- `supabase/migrations/20260520120000_fix_shopping_items_update_rls_for_soft_delete.sql` — removed `deleted_at IS NULL` from `WITH CHECK` clause of `shopping_items_update_member` policy so that direct soft-deletes via UPDATE work (needed for recipe ingredient propagation)
- `supabase/migrations/20260520130000_add_get_recipe_linked_lists_fn.sql` — SECURITY DEFINER function to find linked shopping lists even when all items are soft-deleted

---

## 2026-05-21 — Phase 7b: Prework Preferences

### Migration: `20260521000001_create_prework_preferences.sql`

Per-member preference filters for accommodation search prework. Each trip member distributes up to 100 credits across free-text filters (e.g., "Pool", "Near beach", "Kitchen") to guide the organizer's external accommodation search.

**Table:**
- `public.prework_preferences` — One row per member per trip. Filters stored as JSONB array `[{ "label": "Pool", "weight": 40 }, ...]`. UNIQUE constraint on `(trip_id, user_id)` enables upsert semantics.

**Columns:**
- `id` UUID PK
- `trip_id` UUID NOT NULL → `trips(id) ON DELETE CASCADE`
- `user_id` UUID NOT NULL → `users(id) ON DELETE CASCADE`
- `filters` JSONB NOT NULL DEFAULT `'[]'` with CHECK `jsonb_typeof(filters) = 'array'`
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

**RLS Policies:**
- `prework_preferences_select_member` — SELECT: any trip member can see all preferences for their trip
- `prework_preferences_insert_member` — INSERT: trip members can insert their own row only (`user_id = auth.uid()`)
- `prework_preferences_update_own` — UPDATE: own row only
- `prework_preferences_delete_own` — DELETE: own row only

**Triggers:**
- `prework_preferences_updated_at` — BEFORE UPDATE: reuses existing `set_updated_at()`

**Indexes:**
- `idx_prework_preferences_trip_id` on `prework_preferences(trip_id)`

**Design decisions:**
- JSONB single-row-per-member pattern avoids cross-row sum constraints — 100-credit max enforced at app level via Zod
- No status/voting columns — this is a lightweight input-gathering feature, not a voting system
- All members can see all preferences (no privacy restrictions)

**Local migration file:** `supabase/migrations/20260521000001_create_prework_preferences.sql`

### Migration: `20260521000002_enable_prework_realtime.sql`

Added `prework_preferences` table to Supabase Realtime publication for live preference updates across trip members.

**Realtime publication additions:**
- `public.prework_preferences` — live INSERT/UPDATE/DELETE events

**Architecture:**
- One realtime channel per trip: `prework:{tripId}`
- Server-side filter on `trip_id=eq.{tripId}`
- Client uses `setQueryData` for surgical cache updates on INSERT/UPDATE/DELETE
- Follows existing realtime pattern: exponential backoff reconnection [2s, 5s, 10s, 30s], AppState foreground resubscription + query invalidation

**Local migration file:** `supabase/migrations/20260521000002_enable_prework_realtime.sql`

---

## 2026-05-22 — Phase 7c: Transfer (Flights, Vehicles, Rental Cars)

### Migration: `20260522000001_create_transfer_flights_and_votes`

**Tables:**
- `public.transfer_flights` — Flight options per trip with soft delete, direction (outbound/return), airline info, departure/arrival airports + times, price per person, post-booking fields (flight_number, booking_reference), status lifecycle (suggested/booked/completed), voting flag
- `public.transfer_flight_votes` — Non-numeric voting (must_do/like/open/skip/group_blocker), UNIQUE on (flight_id, user_id) for upsert semantics

**RLS Policies:**
- `transfer_flights`: SELECT by trip members (non-deleted), INSERT by trip members (created_by = self), UPDATE by organizer any or creator own
- `transfer_flight_votes`: SELECT by trip members, INSERT/UPDATE/DELETE by own user + voting must be open; own-update policy also checks trip membership

**Triggers:**
- `transfer_flights_updated_at` — auto-updates `updated_at` on UPDATE
- `restrict_transfer_flight_update_fields` — BEFORE UPDATE: prevents changing trip_id/created_by; restricts voting_open, status, flight_number, booking_reference changes to organizers only; skips check when called from nested trigger (pg_trigger_depth > 1)
- `auto_finalize_transfer_flight_voting` — AFTER INSERT/UPDATE on transfer_flight_votes: SECURITY DEFINER, sets voting_open=FALSE when all trip members have voted

**Functions:**
- `public.soft_delete_transfer_flight(p_flight_id UUID)` — SECURITY DEFINER: organizer any, participant own, guest cannot
- `public.close_transfer_flight_voting(p_flight_id UUID)` — SECURITY DEFINER: organizer only
- `public.reopen_transfer_flight_voting(p_flight_id UUID)` — SECURITY DEFINER: organizer only
- `public.book_transfer_flight(p_flight_id UUID, p_flight_number TEXT DEFAULT NULL, p_booking_reference TEXT DEFAULT NULL)` — SECURITY DEFINER: organizer only, atomically sets status='booked' + voting_open=FALSE

**Constraints:**
- `transfer_flights_external_url_https` — CHECK enforcing `https://` prefix on external URLs

**Indexes:**
- `idx_transfer_flights_trip_id` (partial: deleted_at IS NULL)
- `idx_transfer_flights_created_by`
- `idx_transfer_flight_votes_flight_id`
- `idx_transfer_flight_votes_user_id`

**Local migration file:** `supabase/migrations/20260522000001_create_transfer_flights_and_votes.sql`

---

### Migration: `20260522000002_create_transfer_flight_passengers`

**Table:**
- `public.transfer_flight_passengers` — Passengers assigned to a booked flight. UNIQUE on (flight_id, user_id).

**RLS Policies:**
- SELECT: trip members (via flight → trip join)
- INSERT/DELETE: organizer only

**Triggers:**
- `verify_flight_booked_before_passenger` — BEFORE INSERT: raises exception if the flight's status is not 'booked'

**Functions:**
- `public.set_transfer_flight_passengers(p_flight_id UUID, p_user_ids UUID[])` — SECURITY DEFINER: organizer only, atomically replaces entire passenger list (DELETE all + INSERT new) in a single transaction

**Indexes:**
- `idx_transfer_flight_passengers_flight_id`

**Local migration file:** `supabase/migrations/20260522000002_create_transfer_flight_passengers.sql`

---

### Migration: `20260522000003_create_transfer_vehicles_and_passengers`

**Tables:**
- `public.transfer_vehicles` — Personal vehicles per trip with soft delete and direction (outbound/return)
- `public.transfer_vehicle_passengers` — Members in each vehicle with an `is_driver` flag. UNIQUE on (vehicle_id, user_id).

**RLS Policies:**
- `transfer_vehicles`: SELECT by trip members (non-deleted), INSERT by trip members, UPDATE by organizer or creator
- `transfer_vehicle_passengers`: SELECT by trip members (via vehicle → trip join), INSERT/UPDATE/DELETE by organizer or vehicle creator

**Triggers:**
- `transfer_vehicles_updated_at` — auto-updates `updated_at` on UPDATE

**Functions:**
- `public.soft_delete_transfer_vehicle(p_vehicle_id UUID)` — SECURITY DEFINER: organizer any, participant own, guest cannot

**Indexes:**
- `idx_transfer_vehicles_trip_id` (partial: deleted_at IS NULL)
- `idx_transfer_vehicles_created_by`
- `idx_transfer_vehicle_passengers_vehicle_id`

**Local migration file:** `supabase/migrations/20260522000003_create_transfer_vehicles_and_passengers.sql`

---

### Migration: `20260522000004_create_transfer_rentals`

**Table:**
- `public.transfer_rentals` — Rental car bookings per trip with soft delete. No voting, no passengers. Fields: company, pickup/dropoff locations, pickup/dropoff dates, booking_reference, price_total, external_url (HTTPS-only), notes.

**RLS Policies:**
- SELECT: trip members (non-deleted)
- INSERT: trip members (created_by = self)
- UPDATE: organizer or creator

**Triggers:**
- `transfer_rentals_updated_at` — auto-updates `updated_at` on UPDATE

**Functions:**
- `public.soft_delete_transfer_rental(p_rental_id UUID)` — SECURITY DEFINER: organizer any, participant own, guest cannot

**Constraints:**
- `transfer_rentals_external_url_https` — CHECK enforcing `https://` prefix on external URLs

**Indexes:**
- `idx_transfer_rentals_trip_id` (partial: deleted_at IS NULL)
- `idx_transfer_rentals_created_by`

**Local migration file:** `supabase/migrations/20260522000004_create_transfer_rentals.sql`

---

### Migration: `20260522000005_enable_transfer_realtime`

Added all six transfer tables to Supabase Realtime publication and configured REPLICA IDENTITY for junction tables.

**Realtime publication additions:**
- `public.transfer_flights` — live INSERT/UPDATE events
- `public.transfer_flight_votes` — live INSERT/UPDATE/DELETE events
- `public.transfer_flight_passengers` — live INSERT/DELETE events
- `public.transfer_vehicles` — live INSERT/UPDATE events
- `public.transfer_vehicle_passengers` — live INSERT/UPDATE/DELETE events
- `public.transfer_rentals` — live INSERT/UPDATE events

**REPLICA IDENTITY changes:**
- `public.transfer_flight_votes` → FULL (DELETE payloads include all columns to identify the flight a vote belonged to)
- `public.transfer_flight_passengers` → FULL (DELETE payloads include all columns)
- `public.transfer_vehicle_passengers` → FULL (DELETE payloads include all columns)

**Architecture:**
- One channel per trip per category: `transfer-flights:{tripId}:{uid}`, `transfer-vehicles:{tripId}:{uid}`, `transfer-rentals:{tripId}:{uid}`
- Flight channel subscribes to vote, flight update, and passenger change events
- Vehicle channel subscribes to vehicle and vehicle-passenger change events
- All channels use exponential backoff reconnection and AppState foreground resubscription

**Local migration file:** `supabase/migrations/20260522000005_enable_transfer_realtime.sql`

---

### Migration: `20260522000006_transfer_outbound_return`

Extended `transfer_flights` to support round-trip tickets stored as a single entry.

**Schema changes:**
- `transfer_flights.direction` CHECK constraint extended to accept `'outbound-return'` (was `'outbound' | 'return'`)
- Added four return-leg columns (all nullable, only used when `direction = 'outbound-return'`):
  - `return_departure_airport TEXT` CHECK `char_length <= 100`
  - `return_arrival_airport TEXT` CHECK `char_length <= 100`
  - `return_departure_time TIMESTAMPTZ`
  - `return_arrival_time TIMESTAMPTZ`
- `REPLICA IDENTITY FULL` applied to `transfer_flights` so realtime INSERT events carry the full row payload

**Why REPLICA IDENTITY FULL:** The flight INSERT realtime handler was added to ensure other users see new flights without a manual refresh. Full replica identity guarantees the complete row is available in the INSERT payload.

**Local migration file:** `supabase/migrations/20260522000006_transfer_outbound_return.sql`

---

## 2026-05-22 — Transfer: Vehicle outbound-return + Realtime REPLICA IDENTITY

### Migration: `20260522000007_vehicle_outbound_return_and_replica_identity`

**Changes:**
- `transfer_vehicles.direction` CHECK constraint extended to allow `'outbound-return'` (was only `'outbound' | 'return'`)
- `REPLICA IDENTITY FULL` applied to `transfer_vehicles` — ensures the `trip_id` filter on realtime UPDATE events (soft-delete) works reliably for all subscribers
- `REPLICA IDENTITY FULL` applied to `transfer_rentals` — same reason

**Why REPLICA IDENTITY FULL on vehicles and rentals:** Without it, UPDATE payloads in Supabase realtime only include changed columns. The `trip_id` filter on the subscription would not match because `trip_id` is not present in the old/new diff. Setting FULL replica identity guarantees all columns are available in every UPDATE payload, enabling correct filter evaluation and soft-delete propagation to all users.

**Local migration file:** `supabase/migrations/20260522000007_vehicle_outbound_return_and_replica_identity.sql`

---

## 2026-05-25 — Phase 7d: Profile Settings — Encrypted Travel Documents & Organizer Access

### Migration: `20260525000001_enable_pgcrypto_and_vault_secret`

Bootstraps the encryption layer for travel document PII fields.

**Extensions:**
- `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions` — provides `pgp_sym_encrypt` / `pgp_sym_decrypt` / `gen_random_bytes`
- `CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault` — secure key storage

**Vault secret:**
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'travel_documents_encryption_key') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'travel_documents_encryption_key',
      'AES-256 key for encrypting travel document PII fields'
    );
  END IF;
END $$;
```
**IMPORTANT:** Use `vault.create_secret()` (SECURITY DEFINER function), NOT `INSERT INTO vault.secrets` directly. Direct INSERT triggers `_crypto_aead_det_noncegen`, which requires pgsodium internals unavailable to the migrator role and produces `permission denied for function _crypto_aead_det_noncegen`.

**Private helper:**
- `private.get_travel_doc_encryption_key() RETURNS TEXT` — SECURITY DEFINER, reads from `vault.decrypted_secrets`. Isolates vault access to a single trusted function; SECURITY DEFINER RPCs call this helper, PostgREST API cannot reach it.

**Local migration file:** `supabase/migrations/20260525000001_enable_pgcrypto_and_vault_secret.sql`

---

### Migration: `20260525000002_create_user_travel_documents`

Creates the encrypted travel document store.

**Table `user_travel_documents`:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK→users | CASCADE |
| `document_type` | TEXT | CHECK ('passport', 'id_card') |
| `full_legal_name` | BYTEA | AES-256 encrypted |
| `document_number` | BYTEA | AES-256 encrypted |
| `date_of_birth` | BYTEA | AES-256 encrypted |
| `nationality` | TEXT | plaintext ISO alpha-2 |
| `issuing_country` | TEXT | plaintext ISO alpha-2 |
| `expiry_date` | DATE | plaintext (for reminder logic) |
| `notes` | BYTEA | AES-256 encrypted |
| `created_at`, `updated_at` | TIMESTAMPTZ | `set_updated_at()` trigger |
| UNIQUE(user_id, document_type) | | one per type per user |

**RLS:** Enabled. SELECT restricted to `user_id = auth.uid()`. INSERT/UPDATE/DELETE policies deny all (`WITH CHECK (false)`) — forces all writes through SECURITY DEFINER RPCs.

**RPCs (all SECURITY DEFINER, `SET search_path = ''`):**
- `upsert_travel_document(p_document_type, p_full_legal_name, p_document_number, p_date_of_birth, p_nationality, p_issuing_country, p_expiry_date, p_notes)` — encrypts sensitive fields, upserts on `(user_id, document_type)` conflict
- `get_my_travel_documents()` — returns decrypted rows for `auth.uid()` only
- `delete_travel_document(p_document_id)` — deletes own document by id

**Local migration file:** `supabase/migrations/20260525000002_create_user_travel_documents.sql`

---

### Migration: `20260525000003_create_document_access_system`

Creates the time-limited access request and grant system.

**Table `document_access_requests`:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `trip_id` | UUID FK→trips | CASCADE |
| `requested_by` | UUID FK→users | CASCADE |
| `duration_minutes` | INT | CHECK (15, 30, 60) |
| `created_at` | TIMESTAMPTZ | |

**Table `document_access_grants`:**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `request_id` | UUID FK→document_access_requests | CASCADE |
| `user_id` | UUID FK→users | CASCADE |
| `granted` | BOOLEAN | |
| `expires_at` | TIMESTAMPTZ | set when granted=true |
| `responded_at` | TIMESTAMPTZ | |
| UNIQUE(request_id, user_id) | | one response per member |

**RLS:** Requests visible to trip members. Grants visible to own user + the organizer who made the request. No direct writes (RPCs only).

**RPCs:**
- `create_document_access_request(p_trip_id, p_duration_minutes)` — organizer only, rate-limited to 1 active request per trip per 24h
- `respond_to_document_access_request(p_request_id, p_granted)` — member only (not the requester), sets `expires_at = NOW() + duration` if granted
- `get_my_pending_access_requests()` — returns unresponded requests for current user, with trip title + requester info
- `get_accessible_member_documents(p_trip_id)` — organizer only, returns decrypted docs for members with active non-expired grants

**Local migration file:** `supabase/migrations/20260525000003_create_document_access_system.sql`

---

### Migration: `20260525000004_profile_settings_security_fixes`

Security hardening migration applying all CRITICAL and HIGH fixes found during security review.

**New table `document_access_audit_log`:**
- Records every `get_accessible_member_documents` call (organizer, member, timestamp)
- RLS: organizer sees their own entries; member sees entries where their docs were accessed
- No direct INSERT (populated only by the SECURITY DEFINER RPC)

**Updated RPC `upsert_travel_document`:**
- Added `trim()` on all text inputs
- ISO alpha-2 regex validation: `^[A-Z]{2}$` on `nationality` and `issuing_country`
- Date format regex: `^\d{4}-\d{2}-\d{2}$` on `date_of_birth`

**Updated RPC `create_document_access_request`:**
- Rate limit tightened from per-organizer-per-trip to per-trip (any organizer)

**Updated RPC `respond_to_document_access_request`:**
- TOCTOU mitigation: rejects requests older than 24 hours (`created_at < NOW() - INTERVAL '24 hours'`)

**Updated RPC `get_accessible_member_documents`:**
- Inserts into `document_access_audit_log` before returning documents

**New RPC `revoke_document_access(p_request_id UUID)`:**
- Allows a member to revoke their own grant: sets `granted=false, expires_at=NULL`

**New RPC `get_my_active_grants()`:**
- Returns grants where `granted=true AND expires_at > NOW()` for caller, with trip title + requester info

**Local migration file:** `supabase/migrations/20260525000004_profile_settings_security_fixes.sql`

---

### Security Architecture Summary (4-Layer Model)

| Layer | Mechanism | What It Protects Against |
|-------|-----------|--------------------------|
| **Database** | pgcrypto AES-256 column encryption + Vault key + SECURITY DEFINER RPCs (no direct table access) | DB breach, stolen backups, direct SQL access |
| **Network** | HTTPS/TLS (Supabase default) | MITM, eavesdropping |
| **Application** | TanStack Query `staleTime: 0` + `gcTime: 0`, no local caching | Device theft, memory inspection |
| **UX** | Biometric/PIN gate (`expo-local-authentication`), masked doc numbers, 30s auto-hide, AppState lock | Shoulder surfing, unlocked device |

---

## 2026-05-22 — Transfer: Fix soft-delete realtime propagation (RLS)

### Migration: `20260522000008_transfer_realtime_softdelete_rls`

**Problem:** After a soft-delete UPDATE, the updated row has `deleted_at IS NOT NULL`. The previous SELECT RLS policy required `deleted_at IS NULL`, so Supabase realtime dropped the UPDATE event for other subscribers — they never saw the deletion. Adding `REPLICA IDENTITY FULL` was necessary but not sufficient; the RLS gate was still blocking delivery.

**Fix:**
- Removed `deleted_at IS NULL` from the SELECT RLS policies on `transfer_flights`, `transfer_vehicles`, and `transfer_rentals`
- Added explicit `.is('deleted_at', null)` filters to `getTransferFlights`, `getTransferVehicles`, and `getTransferRentals` in the API layer, so deleted items still don't appear in regular queries
- Now the post-soft-delete row passes RLS (trip member check only), Supabase realtime delivers the UPDATE event, and the client-side `onUpdate` handler removes the item from the cache

**Local migration file:** `supabase/migrations/20260522000008_transfer_realtime_softdelete_rls.sql`
