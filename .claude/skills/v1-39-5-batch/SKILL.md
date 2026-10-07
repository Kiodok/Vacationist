---
name: v1-39-5-batch
description: Use to answer "what's in v1.39.5" / "status of v1.39.5", or before touching trip_members role changes, trip_members_update/delete RLS policies, soft_delete_trip, delete_own_account's organizer-promotion logic, or the trip settings member list.
---

v1.39.5 adds multiple organizers per trip. The creator becomes the **main organizer** — no new
`main_organizer` role/column; it's just `trips.created_by === currentUser.id` client-side, or
`private.is_trip_creator(trip_id, user_id)` server-side. Appointed organizers get the same
`role = 'organizer'` trip_members row and keep every other organizer power.

**Why:** the Tech Lead wanted to spread organizer duties across more than one person per trip
without inventing a parallel role system.

**How to apply:**
- Only the main organizer can: appoint a `participant` to `organizer` / revoke an appointed
  organizer back to `participant`, remove a member who already holds `organizer`, or delete
  (archive) the trip. Any organizer (main or appointed) keeps every other power — invites, nudge,
  member documents, removing participants/guests, closing voting, editing the trip.
- A `guest` row is never eligible for promotion, and nothing ever demotes a member to `guest` —
  enforced by a DB trigger (`check_organizer_role_change`), not just the UI.
- The main organizer's own `trip_members` row is immutable (can't be demoted or removed) outside
  `delete_own_account()`. Appointed organizers CAN use "Leave Trip" — only the main organizer
  can't (Tech Lead decision during planning; the previous single-organizer-only app hid "Leave
  Trip" for every organizer, which no longer applies).
- `delete_own_account()` (`supabase/migrations/20261007100000_multiple_trip_organizers.sql`): if
  the deleting user is a trip's creator and other members remain, `trips.created_by` transfers to
  the earliest-joined remaining organizer (then participant, then guest) instead of going to the
  sentinel — so a trip never permanently loses the ability to appoint new organizers. See
  [[feedback-migration-create-or-replace-latest-body]] for a mistake caught while writing this
  specific step.
- Client: `apps/mobile/app/trip/[id]/settings.tsx` — `isMainOrganizer` alongside `isOrganizer`.
  Member rows show a shield-icon toggle (main-organizer-only, hidden for guests and the creator's
  own row) wired to `useUpdateMemberRole` (`useMembers.ts`) — this hook existed before v1.39.5 but
  was never reachable from any UI; its toasts were hardcoded English, fixed to use i18n while
  wiring it in.
- `canRemove` in settings.tsx must mirror the DB `trip_members_delete` policy exactly: main
  organizer removes anyone; any other organizer only removes non-organizer rows. If you change one
  side, change the other — they're meant to agree so a button is never shown for an action the
  server will reject.
- `packages/api/src/members.ts`'s `updateMemberRole()` and `removeTripMember()` both chain
  `.select('id')` and throw on a 0-row result — required because Supabase returns
  `{ data: null, error: null }` (not an error) when RLS silently blocks an UPDATE/DELETE. Any new
  trip_members mutation needs the same pattern or an RLS denial will look like a false success.
- `private.is_trip_creator()` checks both `trips.created_by` AND a live `trip_members` row for
  that user (`20261007110000_harden_is_trip_creator_membership_check.sql`) — don't simplify it
  back to a bare `created_by` lookup even though the creator's row is currently guaranteed
  immutable; the extra check is deliberate defense in depth for this authorization-critical helper.
- Two controls on the same member row (the organizer toggle, the remove button) must each respect
  the other's in-flight mutation state (`isRoleChanging` / `isPending`) to prevent a same-row
  double-tap race where one mutation resolves after the row it targeted has already changed shape.

Related: [[v1-39-4-batch]], [[no-branches-main-only]], [[feedback-migration-create-or-replace-latest-body]].
