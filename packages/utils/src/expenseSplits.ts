import { roundCurrency, isNegligible } from './format';

/**
 * Even split of `total` over `count` people, cent-exact: every share is the rounded average and the
 * LAST share absorbs the rounding remainder — the same rule `create/update_expense_with_splits` applies
 * server-side, so a prefill built from this always passes the RPC's exact-sum check.
 */
export function evenSplitAmounts(total: number, count: number): number[] {
  if (count <= 0) return [];
  const each = roundCurrency(total / count);
  const shares = Array<number>(count).fill(each);
  shares[count - 1] = roundCurrency(total - each * (count - 1));
  return shares;
}

interface StoredSplit {
  user_id: string;
  amount_owed: number | string;
  amount_owed_original_currency?: number | string | null;
}

/**
 * The exact-split inputs for an expense that is already stored as `exact`, in the EXPENSE's currency.
 *
 * `amount_owed` is always the TRIP BASE currency; the exact-amount fields are typed in the expense
 * currency. For a foreign-currency expense `amount_owed_original_currency` holds the share in the
 * expense currency (NULL when the expense is already in the base currency, where `amount_owed` is right).
 * Prefilling from `amount_owed` alone made the shares disagree with the amount and the save fail.
 */
export function storedExactShares(splits: StoredSplit[]): Record<string, string> {
  return Object.fromEntries(
    splits.map((s) => [
      s.user_id,
      Number(s.amount_owed_original_currency ?? s.amount_owed).toFixed(2),
    ]),
  );
}

/** Exact-split inputs seeded with an even split of `total`, so switching to "exact" starts balanced. */
export function evenExactShares(memberIds: string[], total: number): Record<string, string> {
  const shares = evenSplitAmounts(total, memberIds.length);
  return Object.fromEntries(memberIds.map((id, i) => [id, shares[i].toFixed(2)]));
}

/** Sum of the typed exact amounts (blank/invalid fields count as 0). */
export function sumExactAmounts(memberIds: Iterable<string>, amounts: Record<string, string>): number {
  let sum = 0;
  for (const id of memberIds) {
    const value = parseFloat(amounts[id] ?? '');
    if (!isNaN(value)) sum += value;
  }
  return roundCurrency(sum);
}

/**
 * True when an exact split may be submitted. A single member always matches (they owe the whole
 * amount); otherwise the shares must add up to the total to within a cent. A zero/blank total is
 * never "balanced" — there is nothing to save yet, and the amount field's own validation reports it.
 */
export function isExactSplitBalanced(total: number, memberCount: number, sum: number): boolean {
  if (!(total > 0)) return false;
  if (memberCount <= 1) return true;
  return isNegligible(sum - total);
}
