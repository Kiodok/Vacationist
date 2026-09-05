---
name: v1-34-2-batch
description: Use to answer "what's in v1.34.2" / "status of v1.34.2", or before touching computeMyCostShares, the global Analytics tab (app/(tabs)/costs.tsx), the get_my_trip_cost_shares RPC, MyCostShareRow, or the Android add-expense quick-action icon (withQuickActionIcon.js). Records the review-driven fix that made the Analytics "my share" math mirror the Trip Overview group card's entity-vs-expense category precedence (+ rounding / excludedSourceCount / FX-lookup fixes), and round 5 of the quick-action icon (a compiled AndroidManifest meta-data reference) which makes v1.34.2 a full-build, not an OTA.
---

# v1.34.2 batch

Branch `v1.34.2` (off `v1.34.1`). `app.config.ts` at `1.34.2`. PATCH bump — math-correctness
bug fix, no native/plugin change → OTA-eligible (unless the quick-action icon fix lands as a
native change). `npm run typecheck` + `npm test` green (`costSummary.test.ts` at 50 cases).
Origin: a `/review` of the global Analytics tab's math & currency conversion, then a
`/code-review` pass whose 3 findings were all folded in.

## What shipped

1. **Entity-vs-expense precedence in "my share".** `computeMyCostShares` (`@vacationist/utils`)
   double-counted: for a priced entity (accommodation / rental / activity / flight / PT) that
   *also* had a matching categorized expense, it added *both* my even-split of the entity price
   *and* my `expense_splits.amount_owed` debt. A €900 booked hotel + a €900 "accommodation"
   expense split 4 ways → my share 225 + 225 = 450. Fix: mirror `computeTripCostSummary`'s
   category-level precedence — a category with any priced entity of its own suppresses its
   matching `expense_owed_<type>` bucket; `manual` / `shopping` expenses always count.
   - Migration `20260905190000_break_out_my_expense_shares_by_related_type.sql`: `DROP FUNCTION`
     + recreate `get_my_trip_cost_shares()`, adding a `related_type TEXT` OUT column (`NULL`
     except on `expense_owed_by_me` rows) and grouping that branch by `e.related_type` — one row
     per `(trip, related_type)`. `source` stays `'expense_owed_by_me'`; amounts still sum to the
     old per-trip total, so it is **backwards-compatible** with the live v1.34.0/v1.34.1 apps
     (they sum every `expense_owed_by_me` row and never read the new column). Safe to push ahead
     of the app build — and it was: **DEV + PROD, 2026-09-05**.
   - `MyCostShareRow.related_type` added in `@vacationist/types`.
   - Precedence keys off the entity row's **`amount > 0`** (own currency; positive stays
     positive after conversion) — matches `computeTripCostSummary`'s `entitySum === 0` test. A
     comped €0 entity does NOT suppress. One intentional divergence: a rate-less-currency entity
     still suppresses (amount known `> 0` even when unconvertible) — conservative vs. double-count.
   - Migration `20260905200000_gate_my_share_entity_presence.sql` (code-review follow-up):
     `get_my_trip_cost_shares` emits a flight/PT row only when the entry has `>= 1` participant
     (passenger OR ticket). A booked-but-unassigned flight contributes 0 to the group card
     (`price_per_person * 0`) and was wrongly registering transfer presence. Backwards-compatible
     (those rows were always `is_mine = false` → 0). **DEV + PROD, 2026-09-05**, 238/238 parity.

2. **Sub-total rounding.** Each trip's `share` is now `roundCurrency`'d and `totalByYear` /
   `total` are sums of the rounded shares, so the UI's per-trip rows reconcile to the year
   headers and grand total (before: `33.33 + 33.33` under a `66.67` header).

3. **Non-mine flight/PT rows skip FX lookup + `excludedSourceCount` deduped.** A non-`is_mine`
   flight/PT row is skipped before any rate lookup. And because the RPC now emits one expense
   row per `related_type`, one unconvertible currency in a trip is counted once via a per-trip
   `Set<currency>` instead of ~5x.

4. **`EXPENSE_CATEGORY_BY_RELATED_TYPE` removed** (code-review: it was a pure identity map) —
   replaced with an explicit `switch (row.related_type)` mapping into the `expenseOwed` buckets.

5. **Rentals unchanged (confirmed correct).** `transfer_rentals` has no passenger list
   (`transfer_vehicle_passengers` belongs to the price-less `transfer_vehicles`), so a rental
   cost stays an even split across `member_count` — Tech Lead confirmed.

Not changed: `computeTripCostSummary`, the Trip Overview cost card, and the expense "my share"
basis (stays **gross cost incurred** — sum `amount_owed` regardless of settlement; the `cover`
flow already zeroes covered splits).

## Android add-expense quick-action icon — round 5 (done, unconfirmed)

Diagnostics from the Tech Lead: the broken build was **a fresh production `.aab` off `v1.34.1`**
(round 4's `mipmap/` fix WAS built + Play-tested, still failed), symptom = **plain gray generic
shortcut glyph** (`getIdentifier` → 0), direction chosen = **compiled reference**.

Round 5 (`apps/mobile/plugins/withQuickActionIcon.js`): keeps round 4 (raster in
`res/mipmap/ic_shortcut_expense.png` + `res/raw/keep.xml`) and adds a `withAndroidManifest` mod
injecting `<meta-data android:name="com.vacationist.mobile.quickactions.KEEP_SHORTCUT_ICON"
android:resource="@mipmap/ic_shortcut_expense"/>` on `<application>` — the compiled reference
rounds 1–4 never had. R8 GC root + bundletool pins it into every device's base split (same as
`@mipmap/ic_launcher`, and the FCM `@drawable/notification_icon` `<meta-data>` beside it). The
runtime `getIdentifier` call is unchanged, it just always resolves now. Shortcut id
`add-expense-v3` → `add-expense-v4`. A static `res/xml/shortcuts.xml` was ruled out
(`expo-quick-actions@6.0.2` has it commented out + its Kotlin can't read a static String
`shortcut_data` extra → never navigates). Full write-up: [[android-runtime-resource-shrinking]]
round 5. **Unconfirmed until a real Play Store production install.**

**This makes v1.34.2 a native/manifest change → FULL Play Store build required, not OTA.**

## Forward rule

`computeMyCostShares` and `computeTripCostSummary` must stay in agreement on category
precedence: **a priced entity in a category wins; that category's expense bucket only counts
when nothing is priced there; `manual`/`shopping` always count.** If you change one, change the
other. The RPCs stay "dumb" (mechanical filtering + grouping only) — all precedence and
currency-conversion logic lives in the pure, unit-tested utils (`costSummary.test.ts`), because
there is [[no-docker-on-machine]] to test SQL directly.

## Deployment status

- Migrations `20260905190000` + `20260905200000`: **DEV + PROD** (2026-09-05), 238/238 ledger
  parity on both, re-linked to dev. `npm run supabase:types` re-run.
- No Edge Function change.
- **Nothing committed** — [[commit-discipline]]. User tests first.
- Ship = **full Play Store build** (`eas build --profile production --platform android`) — the
  quick-action icon `<meta-data>` is native, not OTA-eligible.

Related: [[v1-34-1-batch]], [[v1-34-0-batch]], [[android-runtime-resource-shrinking]],
[[commit-discipline]], [[no-docker-on-machine]].
