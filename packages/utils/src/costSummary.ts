import type { CostSummaryRow, MyCostShareRow } from '@vacationist/types';
import { convertAmount, type CurrencyRateMap } from './currencyConversion';
import { roundCurrency } from './format';

export type { CostSummaryRow, MyCostShareRow };

// The RPC (get_trip_cost_summary) is deliberately "dumb": mechanical status/soft-delete
// filtering and per-(source, currency) grouping only. Everything below (category-level
// precedence, currency conversion) is a pure, unit-tested function instead of opaque SQL — this
// repo has no Docker/pgTAP to test SQL directly, and this is exactly the kind of combination
// logic that's easy to get subtly wrong (see costSummary.test.ts). `CostSummaryRow.source` is
// `string`, not a closed union (see its doc comment in @vacationist/types) — an unrecognized
// source is safely converted below but simply doesn't contribute to any category until the
// CATEGORY logic in this file is updated for it.

export type CostCategory = 'base' | 'transfer' | 'activities' | 'expenses';

export interface CostSummaryResult {
  /** Sum of all four category totals, in `baseCurrency`. */
  total: number;
  byCategory: Record<CostCategory, number>;
  /** Number of RPC rows dropped because their currency (or `baseCurrency` itself) had no entry
   * in `rates` — surfaced so the UI can show "N amounts excluded — rate unavailable" instead of
   * silently presenting an incomplete total as if it were the whole picture. */
  excludedSourceCount: number;
}

const ENTITY_SOURCES_BY_CATEGORY: Record<'base' | 'transfer' | 'activities', string[]> = {
  base: ['accommodation'],
  transfer: ['transfer_flight', 'transfer_rental', 'transfer_public_transport'],
  activities: ['activity'],
};

/** The expense `related_type` bucket each entity-priced category defers to when it has no
 * priced/committed entity of its own yet (category-level precedence — see module doc on the
 * Tech Lead's "entity price wins" decision). `expense_manual`/`expense_shopping` have no entity
 * counterpart and are handled separately, always additive. */
const EXPENSE_FALLBACK_SOURCE: Record<'base' | 'transfer' | 'activities', string> = {
  base: 'expense_accommodation',
  transfer: 'expense_transport',
  activities: 'expense_activity',
};

/**
 * Converts every row into `baseCurrency`, applies category-level precedence (an entity-priced
 * category's own price sum wins over its matching expense bucket whenever that sum is `> 0`;
 * the expense bucket fills in only when nothing has been priced at the entity level yet), and
 * returns one converted total per category plus a grand total.
 *
 * Known, accepted edge case: an entity priced at exactly 0 (e.g. a free/comped accommodation)
 * is indistinguishable here from "nothing priced yet" — its category's expense fallback would
 * still apply on top of that 0. This mirrors the same simplification already accepted for
 * per-person cost splitting elsewhere in the app rather than requiring a real per-row link
 * (`expenses.related_id`, which the UI does not populate today) to disambiguate.
 */
export function computeTripCostSummary(
  rows: CostSummaryRow[],
  rates: CurrencyRateMap,
  baseCurrency: string,
): CostSummaryResult {
  const sumBySource = new Map<string, number>();
  let excludedSourceCount = 0;

  for (const row of rows) {
    let converted: number;
    if (row.currency === baseCurrency) {
      converted = row.amount;
    } else {
      const rateFrom = rates[row.currency];
      const rateTo = rates[baseCurrency];
      if (rateFrom == null || rateTo == null) {
        excludedSourceCount++;
        continue;
      }
      converted = convertAmount(row.amount, rateFrom, rateTo);
    }
    sumBySource.set(row.source, (sumBySource.get(row.source) ?? 0) + converted);
  }

  const byCategory: Record<CostCategory, number> = { base: 0, transfer: 0, activities: 0, expenses: 0 };
  let expensesTotal = (sumBySource.get('expense_manual') ?? 0) + (sumBySource.get('expense_shopping') ?? 0);

  for (const category of ['base', 'transfer', 'activities'] as const) {
    const entitySum = ENTITY_SOURCES_BY_CATEGORY[category].reduce((sum, source) => sum + (sumBySource.get(source) ?? 0), 0);
    byCategory[category] = entitySum;
    if (entitySum === 0) {
      expensesTotal += sumBySource.get(EXPENSE_FALLBACK_SOURCE[category]) ?? 0;
    }
  }
  byCategory.expenses = expensesTotal;

  const total = byCategory.base + byCategory.transfer + byCategory.activities + byCategory.expenses;

  return { total, byCategory, excludedSourceCount };
}

export interface BudgetProgress {
  /** total ÷ memberCount — the group total's per-person share, shown even without a budget set. */
  perPerson: number;
  /** false when `budgetPerPerson` is null — the caller should render no progress bar/percentage
   * at all in that case, not divide by it or show a 0%/NaN%/Infinity% bar. */
  hasBudget: boolean;
  /** Unclamped — a trip over budget correctly reads e.g. "134%" as text. */
  percent: number;
  /** Clamped to [0, 100] — feed this into a progress bar's fill width so an over-budget trip's
   * bar stops at full rather than overflowing its container or needing its own clamp logic. */
  clampedPercent: number;
}

/**
 * Trip Overview's "≈ X per person (of Y budget)" line + progress bar math. `budgetPerPerson` is
 * nullable (`trips.budget_per_person` has no default) — `memberCount` is always `>= 1` in
 * practice (the organizer is always a member), but this still guards a `0` defensively since
 * dividing a real currency total by zero must never reach the UI as `Infinity`.
 */
export function computeBudgetProgress(total: number, budgetPerPerson: number | null, memberCount: number): BudgetProgress {
  const perPerson = memberCount > 0 ? total / memberCount : total;
  if (budgetPerPerson == null) {
    return { perPerson, hasBudget: false, percent: 0, clampedPercent: 0 };
  }
  const budgetTotal = budgetPerPerson * memberCount;
  const percent = budgetTotal > 0 ? (total / budgetTotal) * 100 : 0;
  return { perPerson, hasBudget: true, percent, clampedPercent: Math.min(100, Math.max(0, percent)) };
}

export interface MyTripCostShare {
  tripId: string;
  tripTitle: string;
  startDate: string;
  year: number;
  /** In `displayCurrency`. */
  share: number;
}

export interface MyCostSharesResult {
  /** One entry per trip the caller belongs to, in the RPC's original row order (grouping/sorting
   * by year is a display concern — see Item 2's UI, not this function's job). Each trip's
   * `share` is rounded to 2 decimals, so `totalByYear` and `total` (both sums of those rounded
   * shares) reconcile to the per-trip rows the UI renders. */
  trips: MyTripCostShare[];
  /** Per-year sum of the (already-rounded) trip shares, itself re-rounded — so the year header
   * the UI shows always equals the sum of that year's visible trip rows. */
  totalByYear: Record<number, number>;
  /** Sum of every trip's rounded share — computed directly from `trips`, never derived from
   * `totalByYear`, so a year-grouping bug can't corrupt it. */
  total: number;
  /** Number of `(trip, currency)` pairs whose amount could not be converted (no cached rate for
   * that currency or for `displayCurrency`) and was therefore dropped from the totals — surfaced
   * so the UI can warn "N amounts excluded — rate unavailable" instead of quietly showing a
   * partial figure. Deduped per trip: many unconvertible rows sharing one currency count once. */
  excludedSourceCount: number;
}

/**
 * "My share" per trip (v1.34.0 item 2 — the global Analytics tab), NOT a uniform
 * `amount ÷ memberCount`. Per source:
 *
 * - `transfer_flight` / `transfer_public_transport`: the entry's price counts in full ONLY when
 *   `is_mine` is true — the caller is an assigned passenger on that specific entry OR has
 *   uploaded a ticket for it (v1.34.1 tasks 3/4) — 0 otherwise. A trip with two flights where
 *   the caller only took one must not be charged for the one they didn't fly. A non-`is_mine`
 *   row is skipped before any FX lookup, so a flight the caller isn't on can't push a
 *   rate-unavailable currency into `excludedSourceCount` (it would never have counted anyway).
 * - `accommodation` / `transfer_rental` / `activity`: no per-person assignment concept on the
 *   table, so an even split across `member_count` is the only available signal — converted per
 *   row, summed, then divided once by `member_count` (not per row, to avoid compounding rounding
 *   error across many small rows).
 * - `expense_owed_by_me`: the caller's own `expense_splits.amount_owed` sum, never re-derived
 *   (that's `get_trip_balances`' job). v1.34.2: the RPC emits one such row per `related_type`,
 *   so this function applies the SAME category-level precedence `computeTripCostSummary` uses —
 *   a category whose entity price is `> 0` (`accommodation` → base,
 *   `transfer_flight`/`transfer_rental`/`transfer_public_transport` → transfer, `activity` →
 *   activities) ignores its matching expense bucket entirely; the expense bucket only counts
 *   when nothing is priced at the entity level yet. `manual` and `shopping` expenses have no
 *   entity counterpart and always count. Without this, a trip with a €900 booked accommodation
 *   AND a €900 "accommodation" expense split 4 ways charged the caller 225 (even split) + 225
 *   (expense debt) = 450 for the same money.
 *
 * Presence is keyed off the entity row's amount being `> 0` (in its own currency — a positive
 * amount stays positive after any conversion), matching `computeTripCostSummary`'s
 * `entitySum === 0` test: a comped / €0 entity does NOT suppress its expense fallback, and a
 * booked flight/PT entry with no assigned passenger or ticket produces no row at all (the RPC
 * gates it — same as its 0 contribution to the group card). The one intentional divergence: an
 * entity priced in a currency with no cached rate still suppresses its fallback here (its amount
 * is known to be `> 0` even though it can't be converted), where the group card would drop it
 * and let the fallback fire — the conservative choice against double-counting.
 */

export function computeMyCostShares(rows: MyCostShareRow[], rates: CurrencyRateMap, displayCurrency: string): MyCostSharesResult {
  const byTrip = new Map<string, MyCostShareRow[]>();
  for (const row of rows) {
    const existing = byTrip.get(row.trip_id);
    if (existing) existing.push(row);
    else byTrip.set(row.trip_id, [row]);
  }

  let excludedSourceCount = 0;
  const trips: MyTripCostShare[] = [];

  /** Convert a row into `displayCurrency`, or `null` when a needed rate is missing. */
  const convert = (row: MyCostShareRow): number | null => {
    if (row.currency === displayCurrency) return row.amount;
    const rateFrom = rates[row.currency];
    const rateTo = rates[displayCurrency];
    if (rateFrom == null || rateTo == null) return null;
    return convertAmount(row.amount, rateFrom, rateTo);
  };

  for (const [tripId, tripRows] of byTrip) {
    const { trip_title: tripTitle, start_date: startDate, member_count: memberCount } = tripRows[0];

    let hasAccommodationEntity = false;
    let hasTransferEntity = false;
    let hasActivityEntity = false;

    let gatedShare = 0; // my flights + PT entries: full price when is_mine, 0 otherwise
    let evenSplitSum = 0; // accommodation + rental + activity entity prices, pre-division
    const expenseOwed = { accommodation: 0, transport: 0, activity: 0, shopping: 0, manual: 0 };
    // Deduped so one unconvertible currency in a trip counts once, not once per row — the RPC
    // now emits an expense row per related_type, which would otherwise multiply the count ~5x.
    const excludedCurrencies = new Set<string>();

    for (const row of tripRows) {
      // Entity presence first, before any FX lookup (`amount` in the row's own currency, `> 0`
      // ⇔ `> 0` converted). Mirrors computeTripCostSummary's `entitySum === 0` test: a comped
      // €0 entity doesn't suppress its fallback; a zero-participant flight/PT produces no row.
      if (row.amount > 0) {
        if (row.source === 'accommodation') hasAccommodationEntity = true;
        else if (row.source === 'activity') hasActivityEntity = true;
        else if (row.source === 'transfer_flight' || row.source === 'transfer_rental' || row.source === 'transfer_public_transport') hasTransferEntity = true;
      }

      if (row.source === 'transfer_flight' || row.source === 'transfer_public_transport') {
        if (!row.is_mine) continue; // costs me nothing — skip before any FX lookup
        const converted = convert(row);
        if (converted == null) { excludedCurrencies.add(row.currency); continue; }
        gatedShare += converted;
        continue;
      }

      const converted = convert(row);
      if (converted == null) { excludedCurrencies.add(row.currency); continue; }

      if (row.source === 'accommodation' || row.source === 'activity' || row.source === 'transfer_rental') {
        evenSplitSum += converted;
      } else if (row.source === 'expense_owed_by_me') {
        switch (row.related_type) {
          case 'accommodation': expenseOwed.accommodation += converted; break;
          case 'transport': expenseOwed.transport += converted; break;
          case 'activity': expenseOwed.activity += converted; break;
          case 'shopping': expenseOwed.shopping += converted; break;
          default: expenseOwed.manual += converted; break; // 'manual', or null / an unknown future type
        }
      }
      // an unrecognized source is converted safely but contributes to no bucket
    }

    excludedSourceCount += excludedCurrencies.size;

    const evenSplitShare = memberCount > 0 ? evenSplitSum / memberCount : evenSplitSum;
    const share = roundCurrency(
      gatedShare +
        evenSplitShare +
        expenseOwed.manual +
        expenseOwed.shopping +
        (hasAccommodationEntity ? 0 : expenseOwed.accommodation) +
        (hasTransferEntity ? 0 : expenseOwed.transport) +
        (hasActivityEntity ? 0 : expenseOwed.activity),
    );
    trips.push({ tripId, tripTitle, startDate, year: Number(startDate.slice(0, 4)), share });
  }

  const totalByYear: Record<number, number> = {};
  for (const t of trips) {
    totalByYear[t.year] = roundCurrency((totalByYear[t.year] ?? 0) + t.share);
  }
  const total = roundCurrency(trips.reduce((sum, t) => sum + t.share, 0));

  return { trips, totalByYear, total, excludedSourceCount };
}
