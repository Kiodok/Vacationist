# Supabase Changes Log

## 2026-06-15 — Feat: Post-Trip Expense Reminder Cron

### Migration: `20260615100000_create_expense_reminder_cron`

**Changes:**
1. **New function `private.create_expense_reminders()`** — Runs daily at 10:00 UTC via pg_cron. Finds trips where `end_date < CURRENT_DATE` and `(today - end_date) IN (1, 3, 7)`. For each such trip, computes unsettled balances inline (cannot use `get_trip_balances` — no `auth.uid()` in cron context), skips trips where all balances are negligible (< 0.01). Creates a `reminder` notification for ALL members via `private.create_trip_notification()` with `related_type='expense_reminder'`.
2. **Deduplication** — Skips if a reminder with `body LIKE '%unsettled expenses%'` was already created today for the trip.
3. **pg_cron job `create-expense-reminders`** — Scheduled at `0 10 * * *` (1 hour after the trip-start reminder job).
4. **No schema changes** — Uses existing `'reminder'` notification type; `related_type` is free-form TEXT.

**Client-side changes (not migrations):**
- `supabase/functions/push-notification/index.ts`: Added `expense_reminder` virtual translation type (en/de). Detection: `type === 'reminder' && dbBody?.includes('unsettled expenses')`.
- `apps/mobile/src/features/notifications/utils/resolveNotificationPath.ts`: Routes `related_type === 'expense_reminder'` to `/trip/${trip_id}?tab=Expenses`.

**Non-destructive:** No schema changes. New pg_cron job only.

**Applied to:** dev + prod

---

## Project Details
- **Project:** dev
- **Project ID:** aejywkbkcwyanhyzhrle
- **Region:** eu-west-3
- **Database:** PostgreSQL 17.6

---

## 2026-06-13 — Fix: settle_all_expenses — Simplified Settlements in Receipt Snapshot

### Migration: `20260613110000_fix_settle_all_snapshot`

**Changes:**
1. **`settle_all_expenses` RPC replaced** — Same behavior, but the receipt snapshot now stores the greedy min-payment paths (exact port of `computeSettlements` in TypeScript) instead of raw `(debtor, creditor)` pair aggregates. Net balances are computed inline (same formula as `get_trip_balances`) before any UPDATEs.
2. **`total_amount` changed** — Now equals the sum of the simplified transfer amounts, not the sum of every individual split.
3. **`NULL::TEXT` cast** — `context_entity` parameter passed with explicit type cast to avoid parameter-binding ambiguity.

**Non-destructive:** `CREATE OR REPLACE FUNCTION` — no schema changes. Existing receipt rows (if any from testing) remain; only future receipts use the new algorithm.

**Applied to:** dev + prod

---

## 2026-06-13 — Feat: Global Settle All with Immutable Transaction Receipts

### Migration: `20260613100000_settle_all_and_receipts`

**Changes:**
1. **New table `settlement_receipts`** — Stores an immutable receipt for every "Settle All" action. Columns: `id`, `trip_id`, `settled_by`, `currency`, `total_amount`, `splits_count`, `snapshot` (JSONB with frozen member names and settlement pairs), `created_at`.
2. **RLS on `settlement_receipts`** — SELECT: trip members only. INSERT/UPDATE/DELETE: all denied via `WITH CHECK (false)` / `USING (false)`. Only the SECURITY DEFINER RPC can insert.
3. **Realtime** — Table added to `supabase_realtime` publication.
4. **`notifications_type_check` extended** — Added `'expense_settlement'` to the allowed type values.
5. **New RPC `settle_all_expenses(p_trip_id UUID) RETURNS UUID`** — Settles ALL open splits across all debtor→creditor pairs in one atomic transaction, cascades cover-expense splits, builds a frozen JSONB snapshot with user names, inserts a receipt row, and calls `private.create_trip_notification` with type `'expense_settlement'`. Returns the receipt UUID. Raises exception if no open splits exist (prevents empty receipts).

**Non-destructive:** The existing `settle_all_for_pair` RPC is kept. New table and new RPC only.

**Applied to:** dev + prod

---

## 2026-06-13 — Security Fix: Validate target_user Membership in Lost & Found Cases

### Migration: `20260613000001_fix_lost_found_target_user_membership`

**Changes:**
1. **`restrict_lost_found_target_user` trigger** (BEFORE INSERT OR UPDATE on `lost_found_cases`) — Raises an exception if `target_user` is set to a UUID that is not a member of the trip. Prevents bad data from being stored at the source.
2. **`notify_new_lost_found_case` trigger function** (defense-in-depth) — Added `private.is_trip_member` check before inserting the notification for `target_user`. Even if the row guard above is bypassed, no notification reaches a non-member user.

**Security impact:** Without this fix any authenticated trip member could deliver a push notification with attacker-controlled text (up to 100 chars) to any user on the platform by supplying an arbitrary UUID as `target_user`. Combined with the unrestricted `users_select_authenticated` policy (any user can read all profiles), this allowed platform-wide push notification spam.

**Non-destructive:** Only affects new inserts/updates where `target_user` is not a trip member — previously invalid data would have been rejected by the notification logic anyway. No existing rows are modified.

**Applied to:** dev + prod

---

## 2026-06-12 — Feat: Add USD Currency Support

### Migration: `20260612140000_add_usd_currency`

**Changes:**
1. **`trips_base_currency_check`** — Replaced CHECK constraint to include `'USD'` alongside `'EUR'` and `'CHF'`.
2. **`expenses_currency_check`** — Replaced CHECK constraint to include `'USD'` alongside `'EUR'` and `'CHF'`.

**Non-destructive:** existing rows are unaffected; only new rows can use `'USD'`. Fully backwards-compatible.

**Applied to:** dev + prod

**App-layer changes:** `CURRENCY` constant in `packages/types/src/enums.ts` updated to `['EUR', 'CHF', 'USD']`; `CURRENCY_SYMBOLS` in `packages/utils/src/format.ts` gains `USD: '$'`; Zod schemas, TypeScript types, and UI currency pickers all derive from the constant automatically.

---

## 2026-06-12 — Fix: Activity Note Notifications + Lost & Found Case Type Editability

### Migration: `20260612120000_activity_note_notif_and_lost_found_case_type`

**Changes:**
1. **`notifications_type_check`** — Extended to include `'activity_note'` as a valid notification type.
2. **`restrict_lost_found_case_update_fields()`** — Removed the `case_type` immutability guard. `trip_id` and `created_by` remain immutable; `case_type` is now freely editable. Fixes the "Cannot change case_type" error when users switch a case between "person unknown / known" variants.
3. **`private.notify_activity_note_added()`** — New AFTER INSERT trigger on `activity_notes`. Notifies all trip members (except the note author) when a note is added. Gated on the `new_activity` preference column. Context columns populated (activity title as entity, trip title, creator name).

**Applied to:** dev + prod

---

## 2026-06-11 — Fix: Push Edge Function Invocation Flood

### Migration: `20260611180000_fix_push_invocation_flood`

**Why:** ~56 notifications with `push_sent_at IS NULL` were being retried every 5 minutes indefinitely, producing ~56 edge function invocations per 5-minute window (228k on dev, 111k on prod in 2.5 weeks). Three root causes found:

**Root cause 1:** `dispatch_pending_push_notifications` had no age limit. Before the June 11 "always mark `push_sent_at`" fix, any notification sent to a user with no push tokens or with preferences off was never marked as sent. Each such row was retried every 5 minutes forever.

**Root cause 2:** Migration `20260611172912` regressed `send_organizer_nudge` in three ways:
- Rate limit reverted to `COUNT(*)` — for a trip with N members, 1 nudge creates N-1 rows, exceeding the limit after `floor(3/(N-1))` nudges instead of 3.
- `related_type` set to `NULL` — trip reminder notifications (also `type='reminder'`) counted against the nudge rate limit.
- `context_trip` set to `v_trip_title` — broke the edge function's `isNudge` detection (`isNudge = type==='reminder' && !context?.trip`), causing nudge push notifications to display the generic "Trip reminder" template instead of the organizer's custom title/body.

**Root cause 3:** No structural guard against permanent retry accumulation (any future transient edge function failure leaves a notification stuck forever).

**Changes:**
- One-time `UPDATE notifications SET push_sent_at = NOW() WHERE push_sent_at IS NULL` clears all currently-stuck rows immediately
- `dispatch_pending_push_notifications()` rewritten to auto-expire notifications older than 24 hours (marks as sent without HTTP call) before the dispatch loop — prevents permanent accumulation
- `send_organizer_nudge` restored to the correct version from `20260523195815`: `COUNT(DISTINCT related_id) WHERE related_type = 'nudge'` for accurate rate limiting; `context_trip = NULL` to preserve the isNudge detection in the edge function; `related_type = 'nudge'` and `related_id = v_nudge_id` for correct distinguishing of nudges vs trip reminders

**Expected result:** Edge function invocations drop to ≤ 1 per actual user action (nudge RPC) or ≤ N per notification batch, with no background flood.

**Applied to:** dev + prod

---

## 2026-06-10 — Bug Fix Batch: Auto-close Voting, Lost & Found, Push Context

### Migration: `20260610100000_fix_activity_auto_close_trigger_depth`

**Why:** Migration `20260531100000` recreated `check_activity_update_permissions` to guard `auto_close` but dropped the `pg_trigger_depth() > 1` bypass from `20260513000001`. When `auto_finalize_activity_voting()` (at trigger depth 1) set `voting_open=FALSE`, the permission check fired at depth 2 with `auth.uid()` = the voter (not organizer) → exception. Also fixed the "already voted but auto_close toggled ON after the fact" edge case.

**Changes:**
- Recreated `check_activity_update_permissions` with `pg_trigger_depth() > 1` bypass restored
- Added `retroactive_auto_close_activity` BEFORE UPDATE trigger: when organizer sets `auto_close=TRUE` and all members have already voted, closes voting immediately in the same statement

---

### Migration: `20260610110000_lost_found_notification_improvements`

**Why:** When a lost/found case had `target_user IS NOT NULL` (e.g. "found item, owner known"), only the owner received a notification — other trip members were silently excluded. Also, no notification was sent when a case was resolved.

**Changes:**
- Rewrote `notify_new_lost_found_case()`: when `target_user IS NOT NULL`, sends a targeted personal notification to the owner AND broadcasts a general notification to all other members (excluding creator and owner)
- Added `notify_lost_found_resolved()` AFTER UPDATE trigger: when `is_resolved` changes FALSE→TRUE, broadcasts a resolution notification to all trip members

---

### Migration: `20260610120000_fix_dispatch_polling_context`

**Why:** `dispatch_pending_push_notifications()` (from `20260527000001`) selected only 9 notification columns — missing `context_entity`, `context_trip`, `context_creator` added in `20260608200000`. Notifications dispatched via polling (all trigger-sourced ones) were delivered without translation context, so the edge function always fell back to English. `create_trip_reminders()` also didn't pass `context_trip`, so trip-reminder push bodies couldn't be translated per-user.

**Changes:**
- Recreated `dispatch_pending_push_notifications()` to SELECT and forward all three context columns in HTTP payload
- Recreated `create_trip_reminders()` to pass `context_trip = v_trip.title` to `create_trip_notification`

**Edge function update** (`supabase/functions/push-notification/index.ts`):
- Updated `reminder` translation template to trip-reminder text (`"Trip reminder"` / `"Reiseerinnerung"`)
- `translateNotification` now distinguishes nudges from trip reminders by checking `context?.trip`: nudges (no context) use DB title/body as-is; trip reminders (context_trip set) use the translated template

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) + prod (`fsfsqghbejwvgxujoyne`). Edge function deployed to both.

---

## 2026-06-11 — 14-Task Batch: Notifications, Accommodation Notes, Booking Dates

### Migration: `20260611172912_fix_create_trip_notification_overload`

**Why (Tasks 13 + 14):** `20260608200000` added a 10-param overload of `private.create_trip_notification` without dropping the original 7-param version. PostgreSQL rejected calls with `NULL` arguments (type `unknown`) because it could not resolve the overload → `send_organizer_nudge` errored. The same migration also removed the `pg_trigger_depth() >= 1` guard, so every trigger-fired notification immediately attempted `net.http_post()` which pg_net silently drops at trigger depth ≥ 1 → notifications stayed with `push_sent_at IS NULL` and were retried by pg_cron every 5 minutes forever.

**Changes:**
- `DROP FUNCTION private.create_trip_notification(7 params)` — removes ambiguous overload
- Rewrote 10-param version: restores `pg_trigger_depth() >= 1` guard (returns early, lets pg_cron handle push dispatch)
- Updated `send_organizer_nudge` to call 10-param signature with explicit `NULL::TEXT, NULL::UUID, NULL::TEXT` for context params
- Updated `dispatch_pending_push_notifications` to SELECT + forward `context_entity`, `context_trip`, `context_creator` columns
- Added `notify_lost_found_target_user_changed()` trigger (Task 11): fires AFTER UPDATE when `target_user` changes to non-NULL on an open case — sends personal notification to target
- Extended `notify_lost_found_resolved()` (Task 12): now handles TRUE→FALSE (re-open) direction — broadcasts reopen notification + personal notification to `target_user` if set

**Applied to:** dev + prod

---

### Migration: `20260611172915_create_accommodation_notes`

**Why (Task 8):** Collaborative free-text notes attached to individual accommodation bases, mirroring `activity_notes`.

**Table created:** `public.accommodation_notes`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| accommodation_id | UUID | FK → accommodations(id) ON DELETE CASCADE |
| trip_id | UUID | NOT NULL, auto-populated by BEFORE INSERT trigger |
| created_by | UUID | FK → users(id) |
| content | TEXT | NOT NULL, 1–1000 chars |
| created_at / updated_at | TIMESTAMPTZ | Auto-maintained |

**RLS:** SELECT (trip member + parent not deleted), INSERT (member + own created_by), UPDATE (owner), DELETE (owner or organizer)

**Applied to:** dev + prod

---

### Migration: `20260611172918_add_accommodation_booking_dates`

**Why (Task 6):** Allow organizers to mark an accommodation as "Booked" with concrete check-in and check-out dates. Multiple bases per trip can be booked.

**Changes:** Added `check_in_date DATE` and `check_out_date DATE` nullable columns to `public.accommodations`.

**Applied to:** dev + prod

---

### Edge function update (`push-notification/index.ts`)

**Why (Tasks 9 + 13):**
- Task 13: `handleSingle` and `handleBatch` early-returned (no tokens, preferences off) without marking `push_sent_at` → pg_cron retried forever. Fixed: always mark `push_sent_at` on every code path.
- Task 9: Added `lost_found_found` / `lost_found_lost` virtual translation types. Detected via `fallbackTitle` matching (`'Item found'` / `'Item lost'`) so personal notifications to tagged members show specific translated titles instead of generic "Lost or Found".

**Applied to:** dev + prod

---

## 2026-06-03 — Activity Notes Feature

### Migrations: `20260603100000_create_activity_notes` + `20260603100001_fix_activity_notes_trip_id_nullable`

**Why:** Collaborative notes/suggestions attached to individual activities. Any trip member can add free-text tips (e.g., "Try the rooftop bar at Hotel X"), visible to all members when the activity detail is expanded.

**Table created:** `public.activity_notes`

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| activity_id | UUID | FK → activities(id) ON DELETE CASCADE |
| trip_id | UUID | Nullable, auto-populated by BEFORE INSERT trigger from parent activity |
| created_by | UUID | FK → users(id) |
| content | TEXT | NOT NULL, 1–1000 chars |
| created_at | TIMESTAMPTZ | Default NOW() |
| updated_at | TIMESTAMPTZ | Auto-maintained by set_updated_at() trigger |

**Key design decisions:**
- `trip_id` is denormalized (nullable, trigger-populated) — matches the `activity_votes` pattern for efficient RLS filtering without JOINs
- The BEFORE INSERT trigger also validates parent activity is not soft-deleted; raises exception if not found
- Hard delete (no `deleted_at`) — matches `trip_notes`
- No realtime subscription — low-frequency feature; query invalidation on mutation only

**RLS policies:**
- SELECT: `is_trip_member(trip_id)` + parent activity not soft-deleted
- INSERT: `created_by = auth.uid()` + `is_trip_member` + parent activity not soft-deleted
- UPDATE: `created_by = auth.uid()` (owner only)
- DELETE: `created_by = auth.uid()` OR `is_trip_organizer` (owner + organizer)

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) + prod (`fsfsqghbejwvgxujoyne`)

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

## 2026-05-26 — Bug fixes: notifications realtime, trip ordering, effective status

### Migration: `20260526000001_scaling_indexes`

Performance improvements for vote rate-limit and nudge rate-limit queries.

**Indexes added:**
- `idx_activity_votes_rate_limit ON activity_votes(user_id, trip_id, created_at DESC)` — turns O(trip_votes) scan into O(1) range scan for `check_vote_rate_limit`
- `idx_accommodation_votes_rate_limit ON accommodation_votes(user_id, trip_id, created_at DESC)`
- `idx_transfer_flight_votes_rate_limit ON transfer_flight_votes(user_id, trip_id, created_at DESC)`
- `idx_notifications_nudge_rate_limit ON notifications(trip_id, created_at DESC) WHERE type = 'reminder'` — partial index for `send_organizer_nudge` rate-limit COUNT

**Function updated:**
- `public.check_vote_rate_limit()` — rewrote 3 sequential `COUNT(*)` calls to a single `COUNT(*) FROM (... UNION ALL ...)` to share one execution plan and short-circuit at the 60-vote limit

---

### Migration: `20260526000002_batch_push_dispatch`

Rewrote push notification dispatch from O(M) vault reads + HTTP calls to O(1) per event.

**Problem:** `private.create_trip_notification` looped over M trip members, and each `notifications` INSERT fired the per-row `trg_dispatch_push_notification` trigger — 2 vault reads + 1 `net.http_post` per row. A 9-member trip triggered 18 blocking vault reads and 9 Edge Function invocations per activity creation.

**Fix:**
- `private.dispatch_push_notification()` updated: returns immediately when `current_setting('app.batch_push_pending', true) = 'true'`
- `private.create_trip_notification()` rewritten: sets the transaction-local flag before the loop, collects `(user_id, notification_id)` pairs, resets the flag after the loop, then reads vault once and calls `net.http_post` once with `batch=true` + UUID arrays

**Edge Function** (`push-notification/index.ts`) already handles the `batch: true` payload — one preference/token query + one Expo API call for all recipients.

---

### Migration: `20260526000003_denormalize_trip_member_count`

Denormalized `member_count` onto `trips` to eliminate the per-row subquery in `getTrips()`.

**Schema change:**
- Added `member_count INTEGER NOT NULL DEFAULT 0` to `public.trips`
- Backfilled from `COUNT(*) per trip_id` in `trip_members`

**Trigger:** `trg_maintain_trip_member_count` (AFTER INSERT OR DELETE on `trip_members`) — `private.maintain_trip_member_count()` SECURITY DEFINER; increments on INSERT, decrements on DELETE (floor at 0)

---

### Migration: `20260526000004_enable_notifications_realtime`

Root cause fix for notifications not updating in real time.

**Problem:** The `notifications` table was never added to the `supabase_realtime` publication. `useNotificationsRealtime` subscribed to `postgres_changes` on `notifications` but received no events — new notifications only appeared after a manual pull-to-refresh.

**Changes:**
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications`
- `ALTER TABLE public.notifications REPLICA IDENTITY FULL` — required so DELETE events include all columns (enabling the `user_id=eq.{userId}` filter) and UPDATE events include old values

### Code changes (2026-05-26 bug fixes)

**`packages/api/src/trips.ts`:**
- `getTrips()` sort order changed from `ascending: false` to `ascending: true` — trips now display earliest start date first

**`apps/mobile/src/features/trips/components/TripCard.tsx`:**
- Added `getEffectiveStatus(trip: Trip): TripStatus` — returns `'completed'` for any trip whose `end_date` is in the past (unless already `'archived'` or `'completed'` in DB); returns `'active'` for ongoing trips; falls back to DB status otherwise
- `<StatusBadge>` now receives `getEffectiveStatus(trip)` instead of `trip.status`

**`apps/mobile/src/features/notifications/hooks/useNotifications.ts`:**
- `useNotifications`: added `refetchInterval: 30_000` (30 s polling fallback)
- `useNotificationsRealtime` `onInsert`: added `queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })` and trip-scoped unread count invalidation — badge now updates immediately when a new notification arrives
- `useNotificationsRealtime` `onUpdate`: added same unread count invalidations — badge updates when a notification is marked read on another device

**`apps/mobile/src/features/notifications/hooks/useUnreadCount.ts`:**
- `useUnreadCount`: added `refetchInterval: 30_000`
- `useTripUnreadCount`: added `refetchInterval: 30_000`

---

## 2026-05-22 — Transfer: Fix soft-delete realtime propagation (RLS)

### Migration: `20260522000008_transfer_realtime_softdelete_rls`

**Problem:** After a soft-delete UPDATE, the updated row has `deleted_at IS NOT NULL`. The previous SELECT RLS policy required `deleted_at IS NULL`, so Supabase realtime dropped the UPDATE event for other subscribers — they never saw the deletion. Adding `REPLICA IDENTITY FULL` was necessary but not sufficient; the RLS gate was still blocking delivery.

**Fix:**
- Removed `deleted_at IS NULL` from the SELECT RLS policies on `transfer_flights`, `transfer_vehicles`, and `transfer_rentals`
- Added explicit `.is('deleted_at', null)` filters to `getTransferFlights`, `getTransferVehicles`, and `getTransferRentals` in the API layer, so deleted items still don't appear in regular queries
- Now the post-soft-delete row passes RLS (trip member check only), Supabase realtime delivers the UPDATE event, and the client-side `onUpdate` handler removes the item from the cache

**Local migration file:** `supabase/migrations/20260522000008_transfer_realtime_softdelete_rls.sql`

---

## 2026-05-26 — Avatars storage bucket

### Migration: `20260526175044_create_avatars_bucket`

**Purpose:** Adds the `avatars` Supabase Storage bucket for user profile pictures, wired up with RLS.

**Storage bucket:**
- Name: `avatars`, public, 5 MB file size limit, MIME types restricted to `image/*`

**RLS policies:**
- `avatars_select` — public SELECT (anyone can read avatar URLs)
- `avatars_insert` — authenticated users can INSERT into their own `{userId}/` folder
- `avatars_update` — authenticated users can UPDATE objects in their own `{userId}/` folder
- `avatars_delete` — authenticated users can DELETE objects in their own `{userId}/` folder

**Upload path convention:** `${userId}/avatar` (no file extension). Fixed path means each upload overwrites the same Storage object — no stale files accumulate when image format changes between uploads.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260526175044_create_avatars_bucket.sql`

---

## 2026-05-26 — Activity creation RPC (SETOF → UUID return type fix)

### Migration: `20260526180000_create_activity_rpc`

**Purpose:** Replaced the direct `INSERT INTO activities` (which required the caller to hold an authenticated session via RLS) with a `SECURITY DEFINER` RPC, fixing activity creation failures on the Android Preview build against prod Supabase.

**Root cause of original failure:** RLS `WITH CHECK` on `public.activities` evaluated the full AND of all conditions; the session was present but `is_trip_member` returned false for the prod environment under the Android client's auth token delivery timing. The SECURITY DEFINER RPC bypasses RLS entirely and runs the member check internally.

**Function:** `public.create_activity(p_trip_id, p_title, p_description, p_category, p_cost_estimate, p_activity_date, p_start_time, p_end_time, p_external_url, p_maps_url)` — original version returned `SETOF public.activities`.

**Local migration file:** `supabase/migrations/20260526180000_create_activity_rpc.sql`

---

### Migration: `20260526190000_fix_create_activity_return_type`

**Purpose:** Changed `create_activity` return type from `SETOF public.activities` to `RETURNS UUID`. The SETOF version worked on Web but caused a silent runtime failure on Android React Native — the fetch polyfill did not parse the SETOF JSON array the same way, so `(data as Activity[])?.[0]` returned `undefined`.

**Fix pattern:** Matches `upsert_travel_document` — RPC returns the new row's UUID, caller then fetches the full row with `getActivity(id)`.

**Migration approach:** `DROP FUNCTION` before `CREATE FUNCTION` — PostgreSQL forbids changing return type via `CREATE OR REPLACE`.

**TypeScript side (`packages/api/src/activities.ts`):** `createActivity` now calls `supabase.rpc('create_activity', {...})` for the UUID, then `getActivity(activityId)` to return the full `Activity` object.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260526190000_fix_create_activity_return_type.sql`

---

## 2026-05-27 — Bug fix: push notifications not delivered for event-triggered notifications

### Migration: `20260527000001_fix_push_dispatch_polling`

**Problem:** Push notifications for `new_activity`, `new_expense`, `new_member`, `vote_finalized`, and `schedule_change` were never delivered to devices. Organizer nudges (type `reminder`) worked correctly.

**Root cause:** `private.create_trip_notification()` calls `net.http_post()` at `pg_trigger_depth() >= 1` — it is invoked from within AFTER INSERT/UPDATE triggers on `activities`, `expenses`, `trip_members`, etc. Supabase's pg_net silently drops HTTP jobs queued from inside a trigger stack. Confirmed by `SELECT * FROM net.http_request_queue` returning 0 rows immediately after activity creation. Nudges worked because `send_organizer_nudge` is a plain RPC (depth 0) — `net.http_post()` ran at depth 0 and queued correctly.

**Fix:**

1. `private.create_trip_notification()` rewritten to detect `pg_trigger_depth() >= 1`. When inside a trigger, the function still INSERTs all notification rows but skips the `net.http_post()` call. At depth 0 (nudge RPC), behavior is unchanged — one immediate batch HTTP call.

2. New `private.dispatch_pending_push_notifications()` SECURITY DEFINER function: queries `notifications WHERE push_sent_at IS NULL AND (push_queued_at IS NULL OR push_queued_at < NOW() - INTERVAL '5 minutes')`, stamps `push_queued_at = NOW()` per row to prevent duplicate dispatch within the retry window, then calls `net.http_post()` once per notification in single-mode payload. Always called at depth 0 by pg_cron, so pg_net queues correctly.

3. `pg_cron` job `dispatch-pending-push-notifications` scheduled `* * * * *` (every minute) to drive the polling function.

4. `push_queued_at TIMESTAMPTZ` column added to `notifications` — prevents re-queueing the same notification on consecutive cron ticks while the Edge Function is processing. `restrict_notification_update_fields` trigger updated to guard this column (only writeable by service role / SECURITY DEFINER, not authenticated users).

5. Partial index `idx_notifications_push_pending ON notifications(created_at ASC) WHERE push_sent_at IS NULL` — makes the polling SELECT fast.

**Latency impact:**
- Nudges: unchanged (immediate, depth-0 batch HTTP call)
- All event notifications: up to ~60 s (next cron tick)

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260527000001_fix_push_dispatch_polling.sql`

---

## 2026-05-27 — Bug fix: missing notification event triggers on prod

### Migration: `20260527000002_fix_missing_event_notification_triggers_prod`

**Problem:** All event-driven notification triggers were absent from prod. Creating an activity, expense, or new member on prod produced no rows in `public.notifications` even though the `create_trip_notification` function and migration history entry existed.

**Root cause:** Migration `20260522213024` was applied to prod before the `CREATE TRIGGER` statements were added to the file (migration drift). The function definitions were present but none of the six triggers were ever created on prod. Only `trg_notify_document_access_request` (from a later migration `20260525000007`) existed.

**Missing triggers restored:**
| Trigger | Table | Event |
|---|---|---|
| `trg_notify_new_activity` | `activities` | AFTER INSERT |
| `trg_notify_new_expense` | `expenses` | AFTER INSERT |
| `trg_notify_new_member` | `trip_members` | AFTER INSERT |
| `trg_notify_activity_vote_finalized` | `activities` | AFTER UPDATE |
| `trg_notify_accommodation_vote_finalized` | `accommodations` | AFTER UPDATE |
| `trg_notify_schedule_change` | `activities` | AFTER UPDATE |

**Migration is idempotent:** uses `DROP TRIGGER IF EXISTS` before each `CREATE TRIGGER` — no-op drops on dev (triggers already existed), clean creates on prod.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260527000002_fix_missing_event_notification_triggers_prod.sql`

---

## 2026-05-27 — Bug fix: check_vote_rate_limit functional drift on prod

### Migration: `20260527000003_fix_check_vote_rate_limit_prod`

**Problem:** `public.check_vote_rate_limit()` on prod was an older version missing two correctness improvements present on dev.

**Missing improvements:**

1. **False-positive rate limiting on UPDATE:** Prod counted UPDATE operations toward the 60-votes/hour quota even when `NEW.vote = OLD.vote` (no-op update). Dev added an early return: `IF TG_OP = 'UPDATE' AND NEW.vote = OLD.vote THEN RETURN NEW; END IF;`

2. **Stale time window for updated votes:** Prod used `created_at` only when counting recent votes, so a vote updated multiple times in the same hour was counted only once. Dev uses `GREATEST(created_at, updated_at)` so each vote change within the hour is counted.

**Root cause:** Same migration drift pattern — the function body was improved on dev after the originating migration had already been applied to prod. The `schema_migrations` version list showed parity; only a full function-body comparison revealed the difference.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260527000003_fix_check_vote_rate_limit_prod.sql`

---

## 2026-05-11 — Phase 1: Users Table

### Migration: `20260511000001_create_users_table`

**Why:** Extends Supabase `auth.users` with app-specific profile data (name, avatar, locale, timezone, guest flag). Auto-creates a profile row on every new auth sign-up.

**Table created:** `public.users`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | FK → `auth.users(id)` CASCADE |
| `name` | TEXT | |
| `email` | TEXT UNIQUE nullable | |
| `avatar_url` | TEXT nullable | |
| `locale` | TEXT | `DEFAULT 'de-DE'` (see later locale migrations) |
| `timezone` | TEXT | `DEFAULT 'Europe/Berlin'` |
| `is_guest` | BOOLEAN | `DEFAULT FALSE` |
| `created_at` | TIMESTAMPTZ | `DEFAULT NOW()` |

**RLS:**
- SELECT: any `authenticated` user (needed for trip member display)
- UPDATE: own row only (`auth.uid() = id`)
- INSERT: own row only (`auth.uid() = id`)

**Trigger:**
- `on_auth_user_created` AFTER INSERT on `auth.users` → `public.handle_new_user()` SECURITY DEFINER — upserts a profile row using `raw_user_meta_data` (full_name/name/avatar_url/is_anonymous).

**Local migration file:** `supabase/migrations/20260511000001_create_users_table.sql`

---

## 2026-05-12 — Fix: redeem_invite_token missing used_at

### Migration: `20260512000002_fix_redeem_invite_token_used_at`

**Problem:** `redeem_invite_token` incremented `use_count` but never set `used_at`, so the column stayed NULL even after successful redemptions.

**Fix:** Updated the `UPDATE invite_tokens SET ...` statement to also set `used_at = NOW()`.

**Local migration file:** `supabase/migrations/20260512000002_fix_redeem_invite_token_used_at.sql`

---

## 2026-05-12 — Add updated_at to core tables

### Migration: `20260512180319_add_updated_at`

**Why:** `public.users`, `public.trips`, and `public.invite_tokens` were missing `updated_at` columns. Also introduces the shared `public.set_updated_at()` trigger function reused across all tables.

**Changes:**
- `ALTER TABLE public.users ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `ALTER TABLE public.trips ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `ALTER TABLE public.invite_tokens ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Created `public.set_updated_at()` RETURNS TRIGGER — sets `NEW.updated_at = NOW()`
- Created `users_updated_at`, `trips_updated_at`, `invite_tokens_updated_at` BEFORE UPDATE triggers

**Local migration file:** `supabase/migrations/20260512180319_add_updated_at.sql`

---

## 2026-05-13 — Fix: auto-finalize activity voting blocked by permission trigger

### Migration: `20260513000001_fix_auto_finalize_voting_permissions`

**Problem:** When a non-organizer cast the last vote on an activity, the `auto_finalize_activity_voting` AFTER INSERT trigger tried to set `voting_open = FALSE`. This fired `check_activity_update_permissions`, which blocked non-organizers from changing `voting_open`.

**Fix:** Added `pg_trigger_depth() > 1` early return to `check_activity_update_permissions()`. Nested trigger updates skip the organizer check; direct client UPDATEs (depth = 1) still get full validation.

**Local migration file:** `supabase/migrations/20260513000001_fix_auto_finalize_voting_permissions.sql`

---

## 2026-05-19 — Unarchive expense

### Migration: `20260519000002_unarchive_expense`

**Why:** Organizers and expense creators need to restore accidentally archived expenses.

**Function:**
- `public.unarchive_expense(p_expense_id UUID)` — SECURITY DEFINER; validates auth, checks `archived_at IS NOT NULL`, verifies caller is organizer or creator, sets `archived_at = NULL`.

**Local migration file:** `supabase/migrations/20260519000002_unarchive_expense.sql`

---

## 2026-05-23 — Fix: trip_id nullable for trigger-populated columns

### Migration: `20260523000002_trip_id_nullable_for_trigger_insert`

**Why:** After `20260523000001` added denormalized `trip_id NOT NULL` columns to 7 child tables, Supabase's generated TypeScript Insert types required callers to supply `trip_id` even though the BEFORE INSERT trigger always populates it. Making the column nullable removes that false requirement from generated types — data integrity is still enforced by the trigger.

**Tables modified:** `activity_votes`, `accommodation_votes`, `transfer_flight_votes`, `transfer_flight_passengers`, `transfer_vehicle_passengers`, `expense_splits`, `shopping_items` — `trip_id` column changed from `NOT NULL` to nullable.

**Local migration file:** `supabase/migrations/20260523000002_trip_id_nullable_for_trigger_insert.sql`

---

## 2026-05-23 — Phase 9 Security: Vote rate limiting

### Migration: `20260523120000_vote_rate_limit`

**Why:** Prevents automated vote spam. Limits to max 60 votes per user per trip per hour, aggregated across all three vote tables.

**Function:** `public.check_vote_rate_limit()` — SECURITY DEFINER; counts rows in `activity_votes`, `accommodation_votes`, `transfer_flight_votes` for the caller in the last hour; raises exception if ≥ 60.

**Triggers (BEFORE INSERT):**
- `on_activity_vote_rate_limit` on `activity_votes`
- `on_accommodation_vote_rate_limit` on `accommodation_votes`
- `on_transfer_flight_vote_rate_limit` on `transfer_flight_votes`

**Note:** This initial version was later hardened by `20260523200051` (UPDATE support, ex-member RLS fix) and again by `20260526000001` (index optimization) and `20260527000003` (prod drift fix).

**Local migration file:** `supabase/migrations/20260523120000_vote_rate_limit.sql`

---

## 2026-05-23 — Security hardening batch

### Migration: `20260523195339_fix_is_guest_self_elevation`

**Problem:** The `users_update_own` RLS policy allowed users to UPDATE any column, including `is_guest`. A guest user could set `is_guest = false` to elevate their own privileges.

**Fix:** Added BEFORE UPDATE trigger `trg_restrict_user_self_update` → `public.restrict_user_self_update()` SECURITY DEFINER — raises exception if `NEW.is_guest IS DISTINCT FROM OLD.is_guest`.

**Local migration file:** `supabase/migrations/20260523195339_fix_is_guest_self_elevation.sql`

---

### Migration: `20260523195712_fix_expense_guest_bypass`

**Problem:** `archive_expense` and `unarchive_expense` both allow the expense creator to act, but guests should have read-only access. A guest who created an expense could archive/unarchive it.

**Fix:** Both functions updated with an explicit `IF v_role = 'guest' THEN RAISE EXCEPTION` check before the creator check.

**Local migration file:** `supabase/migrations/20260523195712_fix_expense_guest_bypass.sql`

---

### Migration: `20260523195815_fix_nudge_rate_limit`

**Problem:** The nudge rate limit counted individual `notifications` rows (N rows per nudge for N−1 members). A trip with 4+ members could only send 1 nudge before the 3-row threshold was hit.

**Fix:** Each nudge now generates a shared `related_id = gen_random_uuid()` stored on all its notification rows. The rate limit counts `COUNT(DISTINCT related_id)` instead of raw rows. Also added input length guards: title ≤ 100 chars, body ≤ 300 chars.

**Index update:** `idx_notifications_nudge_rate_limit` rebuilt as `(trip_id, related_id, created_at DESC) WHERE type = 'reminder' AND related_type = 'nudge'` for efficient distinct-count queries.

**Local migration file:** `supabase/migrations/20260523195815_fix_nudge_rate_limit.sql`

---

### Migration: `20260523195846_fix_expense_splits_direct_insert`

**Problem:** The `expense_splits_insert_creator` RLS policy allowed direct INSERT into `expense_splits`, bypassing trip-member validation enforced inside the RPCs. A caller could insert splits with arbitrary non-member `user_id`s.

**Fix:** Replaced the policy with `expense_splits_insert_rpc_only` — `WITH CHECK (false)`. All writes must go through the SECURITY DEFINER RPCs (`create_expense_with_splits`, `update_expense_with_splits`) which validate every split `user_id` against trip membership.

**Local migration file:** `supabase/migrations/20260523195846_fix_expense_splits_direct_insert.sql`

---

### Migration: `20260523200051_fix_vote_rate_limit_and_rls`

**Two findings fixed:**

**Finding 5 — Rate limit bypassed via UPDATE:** The original rate limit only fired on INSERT. A user could cycle a vote value via UPDATE repeatedly without hitting the cap. Fix:
- Added `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` to `activity_votes`, `accommodation_votes`, `transfer_flight_votes`
- Added `stamp_vote_updated_at()` BEFORE UPDATE triggers on all three tables
- Rewrote `check_vote_rate_limit()`: no-op return when `TG_OP = 'UPDATE' AND NEW.vote = OLD.vote`; counts via `GREATEST(created_at, updated_at)` so each change cycle is counted
- Extended rate-limit triggers to fire on INSERT OR UPDATE

**Finding 6 — Ex-member vote update:** `activity_votes` and `transfer_flight_votes` UPDATE USING clause only checked `user_id = auth.uid()`, allowing a removed member to update their lingering vote row. Fix: added `AND private.is_trip_member(trip_id, auth.uid())` to the USING clause on both tables.

**Index updates:** Composite rate-limit indexes rebuilt to include `updated_at DESC`.

**Local migration file:** `supabase/migrations/20260523200051_fix_vote_rate_limit_and_rls.sql`

---

### Migration: `20260523200134_fix_prework_filters_size_cap`

**Problem:** `prework_preferences.filters` only checked `jsonb_typeof(filters) = 'array'` with no element count limit. An attacker could store an unbounded array causing large row sizes and slow reads for all trip members.

**Fix:** Added CHECK constraint `prework_filters_max_elements` capping the array at 20 elements (`jsonb_array_length(filters) <= 20`).

**Local migration file:** `supabase/migrations/20260523200134_fix_prework_filters_size_cap.sql`

---

### Migration: `20260523200233_fix_push_sent_at_user_writable`

**Problem:** `restrict_notification_update_fields` excluded `push_sent_at` from its immutable-field check, meaning authenticated users could write this internal system timestamp directly.

**Fix:** Added a block: `IF NEW.push_sent_at IS DISTINCT FROM OLD.push_sent_at AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION`. Service-role calls (Edge Function) have `auth.uid() = NULL` and are still permitted; authenticated users are blocked.

**Local migration file:** `supabase/migrations/20260523200233_fix_push_sent_at_user_writable.sql`

---

## 2026-05-25 — Fix: document access concurrent guard

### Migration: `20260525000006_fix_document_access_concurrent_guard`

**Why:** The original `create_document_access_request` had a 24-hour per-organizer-per-trip rate limit, which was too coarse. Replaced with a concurrent-request guard: at most **one active request per trip** at any point in time.

**Active request definition:**
- Created within its own `duration_minutes` window (still pending), OR
- At least one grant tied to it is still non-expired (`granted = true AND expires_at > NOW()`)

**Updated RPC:** `public.create_document_access_request(p_trip_id, p_duration_minutes)` — replaced `COUNT` rate-limit check with `EXISTS` check for any active request matching either condition above.

**Local migration file:** `supabase/migrations/20260525000006_fix_document_access_concurrent_guard.sql`

---

## 2026-05-25 — Document access request notification trigger

### Migration: `20260525000007_notify_document_access_request_trigger`

**Why:** Separated from `20260522213024_create_notification_event_triggers` because `document_access_requests` is created in a later migration (`20260525000003`). The trigger must be created after the table exists.

**Trigger function:** `private.notify_document_access_request()` SECURITY DEFINER — on AFTER INSERT on `document_access_requests`, calls `private.create_trip_notification` with type `'document_access_request'`, excluding the requester.

**Trigger:** `trg_notify_document_access_request` (uses `DROP TRIGGER IF EXISTS` for idempotency).

**Local migration file:** `supabase/migrations/20260525000007_notify_document_access_request_trigger.sql`

---

## 2026-05-28 — User locale normalization

### Migration: `20260528000001_constrain_users_locale`

**Why:** The `locale` column defaulted to `'de-DE'` (a BCP-47 locale tag). The app switched to short codes (`'en'`, `'de'`). This migration normalizes existing values and constrains future ones.

**Changes:**
- Backfills: `'de-DE'` → `'de'`; anything else → `'en'`
- Adds CHECK constraint: `locale IN ('en', 'de')`
- Updates default to `'de'`

**Local migration file:** `supabase/migrations/20260528000001_constrain_users_locale.sql`

---

## 2026-05-29 — Make users.locale nullable

### Migration: `20260529000001_make_users_locale_nullable`

**Why:** Newly registered users should get `locale = NULL` ("preference not yet saved") rather than the forced default `'de'`. The app uses the device locale until the user explicitly sets one in Profile Settings.

**Changes:**
- `ALTER TABLE public.users ALTER COLUMN locale DROP DEFAULT`
- `ALTER TABLE public.users ALTER COLUMN locale DROP NOT NULL`

**Note:** The `CHECK (locale IN ('en', 'de'))` constraint from the previous migration still applies; PostgreSQL evaluates CHECK as NULL (passing) for NULL inputs, so NULL is allowed.

**Local migration file:** `supabase/migrations/20260529000001_make_users_locale_nullable.sql`

---

## 2026-05-31 — Cover split method

### Migration: `20260531000001_add_cover_split_method`

**Why:** Adds a `'cover'` split method where the payer covers the full expense for exactly one other person. Useful for "I'll pay for you" scenarios.

**Schema change:** `expenses.split_method` CHECK constraint extended to include `'cover'`.

**Business rules enforced in RPCs:**
- `cover` requires exactly one split entry
- Cannot cover yourself (`split user_id ≠ paid_by`)
- The covered person is the only ower; the full `p_amount` is their `amount_owed`

Both `create_expense_with_splits` and `update_expense_with_splits` updated to handle `'cover'`.

**Local migration file:** `supabase/migrations/20260531000001_add_cover_split_method.sql`

---

### Migration: `20260531000002_fix_cover_rpc`

**Why:** Repair migration ensuring `create_expense_with_splits` and `update_expense_with_splits` function bodies are up to date after the cover method was added (function drift repair).

**Local migration file:** `supabase/migrations/20260531000002_fix_cover_rpc.sql`

---

### Migration: `20260531000003_fix_cover_expense_model`

**Why:** The initial cover model had the wrong direction — `paid_by = Gary, split user = Gabriel` meant Gabriel owed Gary (debt increases). The correct model is: `paid_by = Gabriel` (their `total_paid` increases, reducing their debt), `split user = Gary, status = 'open'` (Gary owes that amount).

**Fix:** For all existing cover expenses: swaps `paid_by` and the split `user_id` and sets split `status = 'open'`.

**Local migration file:** `supabase/migrations/20260531000003_fix_cover_expense_model.sql`

---

### Migration: `20260531000004_cover_split_cascade_settle`

**Why:** Cover splits must settle atomically with their related non-cover splits to prevent balance formula reversion.

**Rules:**
1. Settling a non-cover split auto-settles any linked cover splits (where `cover.paid_by = ower AND cover split consumer = payer`)
2. Unsettling a non-cover split auto-unsettles those cover splits
3. Settling a cover split directly is blocked

Updated `settle_expense_split` and `unsettle_expense_split` with this cascade logic.

**Local migration file:** `supabase/migrations/20260531000004_cover_split_cascade_settle.sql`

---

### Migration: `20260531000005_cover_existing_split`

**Why:** Adds a way to cover an existing split in-place (e.g., "I'll cover your €10 share"). The covered person's split amount becomes 0 (settled as a gift); the covering person's split grows or is inserted.

**Schema changes:**
- `expense_splits.covered_by UUID REFERENCES public.users(id)` — who covered this split
- `expense_splits.original_amount NUMERIC(10,2)` — saved for uncover reversal

**Functions:**
- `public.cover_split(p_split_id UUID)` — SECURITY DEFINER; validates open+uncovered split, zeros covered split with `covered_by/original_amount/status=settled`, increases or inserts covering user's split
- `public.uncover_split(p_split_id UUID)` — SECURITY DEFINER; organizer or `covered_by` only; restores original amount, removes or reduces covering split

**Local migration file:** `supabase/migrations/20260531000005_cover_existing_split.sql`

---

### Migration: `20260531000006_settle_all_for_pair`

**Why:** Powers the "Settle all" button in the Simplified Settlements view — settles every open split for a debtor→creditor pair in a single atomic call.

**Function:** `public.settle_all_for_pair(p_trip_id UUID, p_debtor UUID, p_creditor UUID) RETURNS INT` — SECURITY DEFINER; loops over open non-cover splits where `paid_by = creditor AND user_id = debtor`; includes the same cover-split cascade as `settle_expense_split`; returns count of settled splits.

**Local migration file:** `supabase/migrations/20260531000006_settle_all_for_pair.sql`

---

### Migration: `20260531000007_remove_cover_cascade`

**Why:** The cover-split cascade in `settle_expense_split` and `unsettle_expense_split` matched by pair (any cover between the same two people), not by specific expense. When multiple covers exist between the same pair, the cascade was unreliable. Cover splits are now settled manually (or via `settle_all_for_pair`).

**Fix:** Removed the cascade UPDATE block from both `settle_expense_split` and `unsettle_expense_split`.

**Local migration file:** `supabase/migrations/20260531000007_remove_cover_cascade.sql`

---

## 2026-05-31 — Add reservation_required to activities

### Migration: `20260531000008_add_reservation_required_to_activities`

**Why:** Allows trip members to mark activities that require advance booking.

**Schema change:** `activities.reservation_required BOOLEAN NOT NULL DEFAULT FALSE`

**RPC update:** `create_activity` signature extended with `p_reservation_required BOOLEAN DEFAULT FALSE` parameter. Function was DROPped and recreated (PostgreSQL forbids changing signature via `CREATE OR REPLACE`).

**Local migration file:** `supabase/migrations/20260531000008_add_reservation_required_to_activities.sql`

---

## 2026-05-31 — Add auto_close to voting entities

### Migration: `20260531100000_add_auto_close_to_voting_entities`

**Why:** Previously, voting always closed automatically once all trip members voted. Organizers needed a way to keep voting open for deliberation. `auto_close = FALSE` (the new default) prevents auto-closure; `auto_close = TRUE` preserves the old behavior.

**Schema changes:**
- `activities.auto_close BOOLEAN NOT NULL DEFAULT FALSE`
- `accommodations.auto_close BOOLEAN NOT NULL DEFAULT FALSE`
- `transfer_flights.auto_close BOOLEAN NOT NULL DEFAULT FALSE`

**Functions updated:**
- `auto_finalize_activity_voting()` — returns early if `auto_close = FALSE`
- `auto_finalize_accommodation_voting()` — same
- `auto_finalize_transfer_flight_voting()` — same
- `check_activity_update_permissions()` — extended to guard `auto_close` changes (organizer only)
- `create_activity` RPC — extended with `p_auto_close BOOLEAN DEFAULT FALSE`

**Local migration file:** `supabase/migrations/20260531100000_add_auto_close_to_voting_entities.sql`

---

### Migration: `20260531100001_guard_auto_close_accommodations_flights`

**Why:** `20260531100000` added `auto_close` guard to activities via `check_activity_update_permissions`. Accommodations and transfer flights needed equivalent guards.

**Triggers added:**
- `on_accommodation_auto_close_check` BEFORE UPDATE on `accommodations` → `check_accommodation_auto_close_permissions()` — raises exception if non-organizer changes `auto_close`
- `on_transfer_flight_auto_close_check` BEFORE UPDATE on `transfer_flights` → `check_transfer_flight_auto_close_permissions()` — same

**Local migration file:** `supabase/migrations/20260531100001_guard_auto_close_accommodations_flights.sql`

---

## 2026-05-31 — Add description to prework preferences

### Migration: `20260531110000_add_description_to_prework`

**Why:** Allows users to write a short free-text note at the top of their preference entry (e.g., "The first base is already decided, let's focus on the second one.").

**Schema change:** `prework_preferences.description TEXT NULL`

**Local migration file:** `supabase/migrations/20260531110000_add_description_to_prework.sql`

---

## 2026-06-01 — Stuff Feature: Packing Lists, Shared Packing, Lost & Found

### Migration: `20260601000001_create_stuff_tables`

**Why:** Introduces three new trip-scoped features — private per-user packing lists, shared packing coordination, and a Lost & Found bulletin.

**Tables created:**

**`public.packing_categories`** (seed/reference table)
- `id`, `name`, `icon`, `sort_order`, `is_default`
- RLS: authenticated SELECT only (no writes from clients)
- Seeded with 8 default categories: Clothes, Cosmetics, Documents, Electronics, Outdoor, Medicine, Shared, Other

**`public.packing_items`** (private per-user)
- `id`, `trip_id` (FK → trips CASCADE), `user_id` (FK → users CASCADE), `category TEXT`, `title TEXT`, `is_packed BOOLEAN DEFAULT FALSE`, `notes TEXT nullable`, `sort_order INT DEFAULT 0`, `source_shared_item_id UUID DEFAULT NULL`, `created_at`, `updated_at`, `deleted_at`
- RLS: SELECT own non-deleted rows + trip membership; INSERT own + trip membership; UPDATE own only
- Triggers: `packing_items_updated_at`, `trg_restrict_packing_item_update` (blocks `trip_id`, `user_id`, `created_at` changes)
- Indexes: `idx_packing_items_trip_user`, `idx_packing_items_category`

**`public.shared_packing_items`** (trip-visible)
- `id`, `trip_id`, `title`, `item_type TEXT CHECK ('i_got_it', 'who_has', 'everyone')`, `notes TEXT nullable`, `created_by`, `claimed_by UUID nullable`, `is_resolved BOOLEAN DEFAULT FALSE`, `created_at`, `updated_at`, `deleted_at`
- RLS: SELECT all trip members (non-deleted); INSERT creator + trip member; UPDATE any trip member (for claiming)
- Triggers: `shared_packing_items_updated_at`, `trg_restrict_shared_packing_item_update` (blocks `trip_id`, `created_by`, `item_type` changes)
- Index: `idx_shared_packing_items_trip`

**`public.lost_found_cases`**
- `id`, `trip_id`, `case_type TEXT CHECK ('lost_unknown', 'lost_known', 'found_unknown', 'found_owner_known')`, `title`, `description TEXT nullable`, `created_by`, `target_user UUID nullable`, `is_resolved BOOLEAN DEFAULT FALSE`, `resolved_at TIMESTAMPTZ nullable`, `created_at`, `updated_at`
- RLS: SELECT trip members where `created_by = me OR target_user = me OR target_user IS NULL`; INSERT creator + trip member; UPDATE any trip member
- Triggers: `lost_found_cases_updated_at`, `trg_restrict_lost_found_case_update` (blocks `trip_id`, `created_by`, `case_type` changes)
- Indexes: `idx_lost_found_cases_trip`, `idx_lost_found_cases_target_user` (partial: `is_resolved = FALSE`)

**Local migration file:** `supabase/migrations/20260601000001_create_stuff_tables.sql`

---

### Migration: `20260601000002_stuff_notification_types`

**Why:** Adds notification types and preference columns for the Stuff feature.

**Changes:**
- `notifications.type` CHECK constraint extended with `'lost_found'` and `'shared_packing'`
- `notification_preferences` table: added `lost_found BOOLEAN NOT NULL DEFAULT TRUE`, `shared_packing BOOLEAN NOT NULL DEFAULT TRUE`

**Local migration file:** `supabase/migrations/20260601000002_stuff_notification_types.sql`

---

### Migration: `20260601000003_stuff_rpcs_and_triggers`

**Why:** Business logic RPCs and notification triggers for the Stuff feature.

**Functions:**
- `public.soft_delete_packing_item(p_item_id UUID)` — SECURITY DEFINER; owner only (checks `user_id = caller`)
- `public.soft_delete_shared_packing_item(p_item_id UUID)` — SECURITY DEFINER; organizer or creator
- `public.claim_shared_packing_item(p_item_id UUID)` — SECURITY DEFINER; any trip member; validates `who_has` type + unclaimed; marks `claimed_by/is_resolved`; auto-inserts a packing_item for claimer under "Shared" category
- `public.copy_packing_list_to_trip(p_source_trip_id UUID, p_target_trip_id UUID) RETURNS INT` — SECURITY DEFINER; copies caller's non-deleted packing items from source trip to target (target must be `planning` or `active`)
- `public.resolve_lost_found_case(p_case_id UUID)` — SECURITY DEFINER; any trip member; sets `is_resolved = TRUE, resolved_at = NOW()`
- `public.delete_lost_found_case(p_case_id UUID)` — SECURITY DEFINER; organizer or creator; hard delete

**Triggers:**
- `trg_notify_new_lost_found_case` AFTER INSERT on `lost_found_cases` → `private.notify_new_lost_found_case()`: broadcasts to all members (type `'lost_found'`) if `target_user IS NULL`; notifies only `target_user` otherwise
- `trg_handle_shared_packing_item_insert` AFTER INSERT on `shared_packing_items` → `private.handle_shared_packing_item_insert()`: for `'everyone'` — auto-inserts packing_item for all members + broadcasts notification; for `'i_got_it'` — auto-inserts for creator + notifies others; for `'who_has'` — no auto-insert, no immediate notification
- `trg_notify_shared_packing_item_claimed` AFTER UPDATE on `shared_packing_items` → `private.notify_shared_packing_item_claimed()`: notifies original creator when `claimed_by` changes from NULL to non-NULL

**Local migration file:** `supabase/migrations/20260601000003_stuff_rpcs_and_triggers.sql`

---

### Migration: `20260601000004_packing_items_unique_source`

**Problem:** `ON CONFLICT DO NOTHING` in `handle_shared_packing_item_insert` was a no-op because no unique constraint existed on `(trip_id, user_id, source_shared_item_id)`. Trigger replays or multiple `'everyone'` items could create duplicate packing rows.

**Fix:** Created partial unique index `idx_packing_items_unique_source ON packing_items(trip_id, user_id, source_shared_item_id) WHERE source_shared_item_id IS NOT NULL AND deleted_at IS NULL`.

**Local migration file:** `supabase/migrations/20260601000004_packing_items_unique_source.sql`

---

### Migration: `20260601000005_packing_dynamic_shared_category`

**Problem:** `claim_shared_packing_item` and `handle_shared_packing_item_insert` hardcoded the string `'Shared'` as the category. If the seeded category is renamed, auto-inserted items silently end up under an orphaned category.

**Fix:** Both functions rewritten to look up the category name via `SELECT name FROM packing_categories WHERE is_default = TRUE AND name = 'Shared' LIMIT 1`, falling back to the literal `'Shared'` only if absent.

Also updated `ON CONFLICT` syntax to use the explicit `ON CONFLICT ON CONSTRAINT idx_packing_items_unique_source DO NOTHING`.

**Local migration file:** `supabase/migrations/20260601000005_packing_dynamic_shared_category.sql`

---

### Migration: `20260601000006_fix_packing_conflict_syntax`

**Problem:** `ON CONFLICT ON CONSTRAINT` only works with named constraints created via `ADD CONSTRAINT`. The unique index from `20260601000004` was created via `CREATE UNIQUE INDEX`, not a named constraint, so PostgreSQL rejected the syntax.

**Fix:**
1. Drop and recreate `idx_packing_items_unique_source` without the `deleted_at IS NULL` predicate (simpler partial index)
2. Rewrite both `claim_shared_packing_item` and `handle_shared_packing_item_insert` to use column-based conflict syntax: `ON CONFLICT (trip_id, user_id, source_shared_item_id) WHERE source_shared_item_id IS NOT NULL DO NOTHING`

**Local migration file:** `supabase/migrations/20260601000006_fix_packing_conflict_syntax.sql`

---

### Migration: `20260601000007_unresolve_lost_found`

**Why:** Allows trip members to revert a mistakenly resolved Lost & Found case back to unresolved.

**Function:** `public.unresolve_lost_found_case(p_case_id UUID)` — SECURITY DEFINER; any trip member; sets `is_resolved = FALSE, resolved_at = NULL`.

**Local migration file:** `supabase/migrations/20260601000007_unresolve_lost_found.sql`

---

### Migration: `20260601000008_unclaim_shared_packing`

**Why:** Allows reversing a packing item claim or an `i_got_it` declaration.

**Function:** `public.unclaim_shared_packing_item(p_item_id UUID)` — SECURITY DEFINER
- `i_got_it`: creator only — sets `is_resolved = FALSE` (item goes back to open state)
- `who_has`: claimer or creator — sets `claimed_by = NULL, is_resolved = FALSE`
- `everyone`: blocked (cannot unclaim)

**Local migration file:** `supabase/migrations/20260601000008_unclaim_shared_packing.sql`

---

## 2026-06-02 — App Enhancements: Notifications, Vehicles, Prework

Three purely additive RPCs. No table changes, no data mutations. Applied to both dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`).

---

### Migration: `20260602000001_add_delete_all_notifications`

**Why:** Previously notifications could only be deleted one at a time. After marking all notifications as read, users now have a single "Delete all" button in both the global and per-trip notification screens.

**Function:**
- `public.delete_all_notifications(p_trip_id UUID DEFAULT NULL)` — SECURITY DEFINER, `SET search_path = ''`; deletes all `notifications` rows where `user_id = auth.uid()`. If `p_trip_id` is provided, scopes deletion to that trip only. Follows the same pattern as `mark_all_notifications_read`.

**RLS note:** No RLS changes needed — the existing DELETE policy already allows users to delete their own rows. The RPC is used for consistency with the mark-all pattern (single call vs. N individual deletes).

**API layer:**
- `packages/api/src/notifications.ts` — added `deleteAllNotifications(tripId?: string)` calling the new RPC
- `packages/api/src/index.ts` — exports `deleteAllNotifications`
- `packages/types/src/schemas.ts` — added `DeleteAllNotificationsVariables = { tripId?: string }`

**Hook:** `useDeleteAllNotifications()` in `useNotifications.ts` — optimistic clear of the notifications cache + unread-count invalidation on settle.

**UI:** Both notification screens now render "Delete all" (red, `text-danger`) in the header when all notifications are read and the list is non-empty. "Mark all as read" continues to appear when any unread notifications exist (the two states are mutually exclusive).

**Local migration file:** `supabase/migrations/20260602000001_add_delete_all_notifications.sql`

---

### Migration: `20260602000002_add_self_assign_vehicle_passenger`

**Why:** Vehicle passenger management was restricted to the organizer or vehicle creator (by RLS INSERT/DELETE policy). Guests, participants, and the organizer now all have a "Join / Leave" button on every vehicle card to self-assign.

**Functions:**
- `public.join_vehicle(p_vehicle_id UUID)` — SECURITY DEFINER, `SET search_path = ''`; validates vehicle exists and not soft-deleted; validates `private.is_trip_member(v_trip_id, auth.uid())`; inserts `(vehicle_id, user_id=auth.uid(), is_driver=false)` with `ON CONFLICT DO NOTHING` (idempotent).
- `public.leave_vehicle(p_vehicle_id UUID)` — SECURITY DEFINER, `SET search_path = ''`; same member check; deletes the caller's own row.

**RLS:** No changes. The existing INSERT/DELETE RLS policies remain in place for the organizer/creator multi-select flow (`PassengerSelectSheet`). The new self-assign RPCs bypass RLS via SECURITY DEFINER and enforce membership themselves.

**API layer:**
- `packages/api/src/transferVehicles.ts` — added `joinVehicle(vehicleId)` and `leaveVehicle(vehicleId)`
- `packages/api/src/index.ts` — exports both

**Hooks:** `useJoinVehicle(tripId, vehicleId)` and `useLeaveVehicle(tripId, vehicleId)` in `useTransferVehiclePassengers.ts`.

**UI:**
- `VehicleCard.tsx` — added `joinAction?: React.ReactNode` prop, rendered between the pressable area and the expanded detail (always visible, outside the tap zone)
- `transfer.tsx` (VehicleCardWithPassengers) — renders a Join (green) or Leave (red) button for every member on every vehicle card; the existing organizer/creator "Passengers" multi-select button remains in the expanded detail section

**Local migration file:** `supabase/migrations/20260602000002_add_self_assign_vehicle_passenger.sql`

---

### Migration: `20260602000003_add_reset_all_prework`

**Why:** Each user's existing "Clear" button only deletes their own prework row (`DELETE WHERE user_id = auth.uid()`). The trip organizer needs a "Reset All Preferences" action that clears all members' rows for a clean restart. The existing RLS DELETE policy (`user_id = auth.uid()`) prevents direct deletion of others' rows, so a SECURITY DEFINER RPC is required.

**Function:**
- `public.reset_all_prework_preferences(p_trip_id UUID)` — SECURITY DEFINER, `SET search_path = ''`; raises exception if `NOT private.is_trip_organizer(p_trip_id, auth.uid())`; deletes all rows from `prework_preferences WHERE trip_id = p_trip_id`.

**API layer:**
- `packages/api/src/prework.ts` — added `resetAllPreworkPreferences(tripId)`
- `packages/api/src/index.ts` — exports it

**Hook:** `useResetAllPreworkPreferences(tripId)` in `usePrework.ts` — invalidates both `prework-preferences` and `my-prework-preferences` query keys on success.

**UI:** Prework tab screen (`trip/[id]/prework.tsx`) — organizer-only "Reset All Preferences" button (danger style) rendered below `GroupSummarySection`, visible only when `isOrganizer && hasAnyPreferences`. Guarded by a native `Alert.alert` confirmation dialog before executing.

**Local migration file:** `supabase/migrations/20260602000003_add_reset_all_prework.sql`

---

### Edge Function update: `push-notification` (2026-06-02)

**Changes:**
- `lost_found` notification type changed from preference-gated to always-on: `preferenceColumn()` now returns `null` for `lost_found` (same as `document_access_request`). The `lost_found` column in `notification_preferences` is retained but no longer consulted.
- Push notification title corrected from `'Lost & Found'` to `'Lost or Found'` (brand wording).
- The "Lost or Found" toggle was removed from `NotificationPreferencesSection.tsx` — the preference UI no longer exposes this column.

**Deployed to:** dev and prod via `supabase functions deploy push-notification`.

---

## 2026-06-02 — Multi-Topic Prework

### Migration: `20260602100000_create_prework_topics`

**Why:** The Prework feature was extended from a single flat preference list per trip to a multi-topic system. Organizers create named topics (e.g. "Trip Type", "Location", "Accommodation Filters"); each member distributes 100 credits independently per topic.

**Table created:** `public.prework_topics`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `trip_id` | UUID FK → trips CASCADE | |
| `title` | TEXT | CHECK length 1–100 |
| `description` | TEXT | nullable; max 500 chars; organizer context for members |
| `seeded_labels` | TEXT[] | default `{}`; max 20 items; organizer-suggested option labels |
| `position` | INT | ordering in segmented control, append-only |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ | `DEFAULT NOW()` |
| `updated_at` | TIMESTAMPTZ | `DEFAULT NOW()`, trigger-maintained |

**RLS:**
- SELECT: `private.is_trip_member(trip_id, auth.uid())`
- INSERT: `created_by = auth.uid() AND private.is_trip_organizer(trip_id, auth.uid())`
- UPDATE: `private.is_trip_organizer(trip_id, auth.uid())`
- DELETE: denied (use `delete_prework_topic` RPC)

**Changes to `public.prework_preferences`:**
- Added `topic_id UUID FK → prework_topics ON DELETE CASCADE` — NOT NULL
- Removed `description` column (moved to `prework_topics`)
- UNIQUE constraint changed from `(trip_id, user_id)` to `(topic_id, user_id)`
- Existing rows migrated: a default "General" topic was created per trip with existing data

**RPCs:**
- `delete_prework_topic(p_topic_id UUID)` — SECURITY DEFINER; organizer only; hard-deletes topic + cascades to all member preferences
- `reset_topic_preferences(p_topic_id UUID)` — SECURITY DEFINER; organizer only; deletes all member preferences for a single topic

**Realtime:** `prework_topics` added to `supabase_realtime` publication with `REPLICA IDENTITY FULL`.

---

### Migration: `20260602100001_prework_preferences_replica_identity`

**Why:** After the multi-topic migration, `prework_preferences` DELETE realtime events did not include `topic_id` in `payload.old` because REPLICA IDENTITY was set to DEFAULT (primary key only). Without `topic_id`, the `usePreworkRealtime` hook could not surgically invalidate the correct topic's cache and had to fall back to a broad `invalidateQueries` on every deletion.

**Change:** `ALTER TABLE public.prework_preferences REPLICA IDENTITY FULL` — ensures all columns, including `topic_id`, appear in DELETE event payloads so the hook can target the specific topic's query cache.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260602100001_prework_preferences_replica_identity.sql`

---

## 2026-06-02 — Trip Reminder Automatic Push Notifications

### Migration: `20260602120000_create_trip_reminder_cron`

**Why:** Trip members had no advance notice before a trip starts. Adds automatic push notifications at 7, 3, and 1 day(s) before every trip that is still in `planning` status.

**Architecture:** Reuses the existing notification pipeline end-to-end:
1. `private.create_trip_reminders()` inserts `notifications` rows (type `reminder`) for all trip members via the existing `private.create_trip_notification()` helper
2. The existing `dispatch-pending-push-notifications` pg_cron job (runs every minute) picks up the new rows and delivers them via the push-notification Edge Function
3. The Edge Function already handles `type = reminder` and checks the `reminder` preference column — members who disabled reminder notifications in trip settings will not receive the push

**Function:** `private.create_trip_reminders() RETURNS INTEGER` — SECURITY DEFINER, `SET search_path = ''`
- Queries `public.trips WHERE deleted_at IS NULL AND status = 'planning' AND (start_date - CURRENT_DATE) IN (1, 3, 7)`
- **Deduplication guard:** skips a trip if a `type = 'reminder'` AND `related_type = 'trip'` row already exists for that trip today — prevents double-sends on cron retry or if the job fires more than once (see `20260602130000` for the fix that replaced a buggy `LIKE` pattern with this discriminant)
- 1-day reminder: title `"Trip starts tomorrow: {title}"`, body `"Your trip starts tomorrow — time to get ready!"`
- 3/7-day reminders: title `"{N} days until {title}"`, body `"Your trip starts in {N} days!"`
- Notifies all members (exclude UUID = `'00000000-0000-0000-0000-000000000000'`, the nil UUID sentinel for "notify all")
- Sets `related_type = 'trip'`, `related_id = trip.id` — deep-link navigates to the trip root

**Cron job:** `create-trip-reminders` scheduled `0 9 * * *` (daily at 09:00 UTC — morning in European timezones)

**No Edge Function changes required** — trip-reminder title/body is set by the DB function and passed as fallback through `translateNotification`; the generic nudge i18n keys are not used.

**No types/hooks/UI changes required** — `type = 'reminder'` is already in the enum, the notification list renders it with the existing `NotificationItem`, and `resolveNotificationPath` already routes `reminder` to the trip root.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260602120000_create_trip_reminder_cron.sql`

---

### Migration: `20260602130000_fix_trip_reminder_dedup`

**Why (bug fix):** The dedup guard in `create_trip_reminders()` used `body LIKE '%trip starts in%'`, which matched the 3-day and 7-day reminders but not the 1-day reminder (`"Your trip starts tomorrow — time to get ready!"`). If the cron fired more than once per day, every trip starting tomorrow would receive duplicate push notifications.

**Fix:** Replaced the fragile body-text match with `related_type = 'trip'`. Organizer nudges (`send_organizer_nudge`) are inserted with `related_type = NULL`, so this discriminant correctly identifies automatic trip reminders without depending on body text. All three reminder windows (1, 3, 7 days) are now protected by the same guard.

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260602130000_fix_trip_reminder_dedup.sql`

---

## 2026-06-03 — Notes Enhancement: is_done column

### Migration: `20260603000001_add_trip_notes_is_done.sql`

**Why:** Added a done/checked state to trip notes so any trip member can mark a note as completed. Supports a collapsible "Done" section in the Notes UI.

**Table altered:** `public.trip_notes`

| Change | Details |
|---|---|
| New column `is_done` | `BOOLEAN NOT NULL DEFAULT FALSE` |
| New RLS policy `trip_notes_update_member_is_done` | Any trip member may UPDATE (for toggling is_done); the trigger restricts non-owners to only changing is_done |
| Trigger `restrict_trip_note_update_fields` replaced | Now also prevents non-owners from modifying `title` or `description` |

**Applied to:** dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`)

**Local migration file:** `supabase/migrations/20260603000001_add_trip_notes_is_done.sql`
