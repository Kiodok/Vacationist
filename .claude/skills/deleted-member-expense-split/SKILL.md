---
name: deleted-member-expense-split
description: Use before touching ExpenseSplitBreakdown.tsx, EditExpenseSheet.tsx's split-composition logic, or create_expense_with_splits / update_expense_with_splits — and whenever a bug report describes an expense split that looks wrong, includes a member who "shouldn't be there," or won't save. Explains the deleted-account sentinel share and why it must never be silently rewritten.
---

# A split can belong to a member who no longer exists

**Rule:** an `expense_splits` row can have `user_id = '00000000-0000-0000-0000-000000000000'` (the
"Deleted User" sentinel) when the member it originally belonged to has since deleted their account —
`delete_own_account()` reassigns their open splits to the sentinel instead of deleting the row
(intentional, documented retention behavior for Play Store Data Safety disclosure —
`docs/delete-account.html`, `CLAUDE.md`'s Account Deletion section). **Never treat this as a bug to
fix by changing `delete_own_account()` itself.**

**Why it looked like a bug:** a tester reported a living member ("Alex") being incorrectly included
in a split, reading "112 = 4 × 28" as Alex silently counted in. Alex was never in it — the 4th share
was the sentinel's. Two real app-layer bugs, confirmed against the actual DB row, made it look that
way:
1. `ExpenseSplitBreakdown.tsx` looked the split's user up in `members` (trip-membership-scoped, so
   the sentinel is never in it) and fell back to the literal string `"Unknown"` — even though the
   split's own embedded `split_user` join already carries the sentinel's real name ("Deleted User").
2. `EditExpenseSheet.tsx`'s `initialSelectedIds` included every id from the stored splits, including
   the sentinel's — inflating `selectedMembers.size` to 4 while only 3 of the 4 rendered chips were
   actually checked (the sentinel has no row in `members` to render a chip for at all), producing a
   literal "4 of 4" header next to a visibly-unchecked chip.

**How to apply:**
- Display: prefer the split's own `split_user` field over a `members` map lookup —
  `members.get(split.user_id) ?? split.split_user`.
- Selection/counting: filter any id list built from `splits` down to ids present in `members` before
  using it for a header count or a chip's selected state.
- **Editing an expense that has a sentinel split must never silently recompute its amount.** The RPCs
  (`create_expense_with_splits` / `update_expense_with_splits`) now accept the sentinel id in the
  membership check (migration `20260922100000`) so a save can go through at all — but the CLIENT is
  responsible for always resubmitting every stored split, sentinel included, with its exact stored
  amount (`amount_owed_original_currency ?? amount_owed`), as `split_method: 'exact'`, regardless of
  what the rest of the form does. `EditExpenseSheet.tsx` locks the split-method controls, the member
  toggle list, the total amount, the tip, and the currency picker whenever
  `splits.some(s => !members.some(m => m.user_id === s.user_id))` — changing the total or currency
  while a locked split exists would either fail the RPC's exact-sum check or silently mislabel the
  departed member's historical share in the wrong currency.
- If a future request wants to actually let the organizer *re-split* including the departed member's
  share (recompute their portion under "even"/"shares"), that is a deliberate product decision with
  real financial-history implications — ask, don't assume; it was explicitly declined for this round
  in favor of the safer lock.

Related: [[offline-client-generated-ids]], `feedback_edge_function_redeploy_after_edit` (same
"verify against the real row, not just the schema" discipline).
