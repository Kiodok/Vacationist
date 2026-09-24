---
name: settled-trip-predicate
description: Use before writing or changing any "is this trip settled / has unsettled expenses" check, a notification cron that reads balances, or create/update_expense_with_splits split rounding. Records the v1.39.1 false-reminder root cause (creditor-AND-debtor rule, FX rounding residue).
---

`private.trip_member_balances(trip)` is the ONE balance computation (`public.get_trip_balances` wraps it). A trip is "unsettled" only if at least one net >= 0.01 AND at least one <= -0.01 — the same rule as `computeSettlements()` in `packages/utils/src/settlements.ts`.

**Why:** v1.39.1 — trip "Sarajevo" (all 109 splits settled) got expense reminders on days 1/3/7 because the cron fired on ANY member's `ABS(net) >= 0.01` and one member sat at +0.01. The cent came from FX rounding: each split is converted with its own `ROUND()` while `converted_amount` is rounded once (BAM @ 1.95583), so splits missed the total by ±0.01–0.02. The same predicate also misfires when a member leaves or deletes their account (their splits are retained, their `trip_members` row is not). Fixed by migrations `20260924100000` / `110000` / `120000`.

**How to apply:** never test "any net ≠ 0" and never hand-copy the balance CTEs — call `private.trip_member_balances`. `private.absorb_split_rounding` adds the residue to the largest non-sentinel split and skips `cover`; it must never touch the Deleted-User sentinel share ([[deleted-member-expense-split]]). Every reminder/nudge cron must exclude `is_example` trips and honour `notification_preferences.reminder`.
