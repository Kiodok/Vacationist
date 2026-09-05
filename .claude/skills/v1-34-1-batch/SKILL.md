---
name: v1-34-1-batch
description: Use to answer "what's in v1.34.1" / "status of v1.34.1", or before touching the Trip Overview cost card, the flight Book sheet, public-transport passengers, the get_trip_cost_summary / get_my_trip_cost_shares RPCs, or the Android "Add Expense" quick-action icon. Records the 5-item v1.34.1 batch (cost-summary freshness, round-trip flight numbers, passenger-or-ticket gated flight & PT costs, mipmap quick-action icon) and its release-ordering constraints.
---

# v1.34.1 batch

Plan: `C:\Users\Gary\.claude\plans\tingly-fluttering-parnas.md`. Branch `v1.34.1`. All 5 items
code-complete; `npm run typecheck` + `npm test` (root) green. `app.config.ts` at `1.34.1`.

## What shipped

1. **Cost summary updates immediately.** `invalidateCostQueries(tripId)` in
   `apps/mobile/src/utils/queryClient.ts` invalidates `['trips', tripId, 'cost-summary']` +
   `['me', 'trip-cost-shares']`. Driven centrally from the mutation-cache subscriber via a
   `COST_AFFECTING_MUTATION_KEYS` set (so persisted replays are covered too), plus explicit
   calls in `useExpensesRealtime`, `useTransferRealtime`, `useTransferDocuments`, and
   `useTransferPublicTransportPassengers`. `computeTripCostSummary` unchanged.

2. **Round-trip flight numbers.** `transfer_flights.return_flight_number` column;
   `book_transfer_flight` now 4-arg (`p_return_flight_number` last, optional) — old 3-arg
   overload dropped in a follow-up migration to avoid a PostgREST ambiguity error.
   `BookFlightSheet` shows two flight-number fields only for `direction === 'outbound-return'`,
   both optional. `FlightCard` / `AllTransfersView` render them with out/ret prefixes.

3. **Flight cost gated by passenger OR ticket.** Ticket = a `transfer_documents` row for the
   `flight_id` + `user_id`. `get_trip_cost_summary` flight amount = `price_per_person ×
   COUNT(DISTINCT passengers ∪ ticket-holders)`. `get_my_trip_cost_shares`'s per-flight OUT
   column renamed `is_my_flight` → **`is_mine`** and now true for a ticket-holder too
   (`MyCostShareRow.is_mine` in `@vacationist/types`).

4. **Public transport passengers.** New `transfer_public_transport_passengers` table — vehicle
   permission model (self join/leave OR entry creator OR organizer, all in the RLS policy; no
   `join_/leave_` RPC), no `is_driver`, no booked gate, denormalized `trip_id` + trigger +
   `REPLICA IDENTITY FULL`. `useTransferPublicTransportPassengers.ts` hook, `PassengerSelectSheet`
   + Join/Leave UI in `PublicTransportCardExpanded`. **PT `price_total` is treated per-person**
   (Tech Lead call): group total = `price_total × participant_count`;
   `get_my_trip_cost_shares` emits one row per PT entry with `is_mine`; `computeMyCostShares`
   moves PT into the gated full-amount branch (was even-split). `create-example-trip` seeds a
   PT passenger.

5. **Quick-action icon — round 4.** v1.34.0's density-independent `drawable/` fix STILL failed
   on Play Store production. Now shipped as `res/mipmap/ic_shortcut_expense.png`
   (`withQuickActionIcon.js`) — mipmap is exempt from R8 resource shrinking and always in every
   bundletool device split; `expo-quick-actions` falls back to the `mipmap` type. Shortcut id
   `add-expense-v2` → `add-expense-v3`. See [[android-runtime-resource-shrinking]]. Unconfirmed
   until a real Play Store install test.

## Deployment status

- Migrations `20260905150000/160000/170000/180000`: **DEV + PROD** (pushed 2026-09-05 at Tech
  Lead request, ahead of the app build). `create-example-trip`: **DEV + PROD**. Ledger parity
  reconfirmed on both.
- Consequence of pushing `170000` early: on the live v1.34.0 app a passenger-less booked
  flight/PT entry now shows 0 in the Overview cost card + Analytics until v1.34.1 ships and
  members assign passengers.
- Task 5 is a plugin change → **full Play Store build, not OTA** (still pending).
- Nothing committed ([[commit-discipline]]).

Related: [[v1-34-0-batch]], [[android-runtime-resource-shrinking]],
[[edge-function-redeploy-after-edit]], [[commit-discipline]].
