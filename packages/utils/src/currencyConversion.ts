import { roundCurrency } from './format';

/**
 * Cross-rate conversion between two EUR-relative exchange rates (see public.exchange_rates —
 * rate = value of 1 EUR in that currency). Pure, display-only math: used both for the
 * per-expense conversion preview (before an expense is submitted) and the "Show in X" toggle
 * (converting already-computed base-currency balances for viewing). Never mutates or feeds
 * back into stored data — the authoritative conversion frozen into expenses.converted_amount
 * happens server-side in create/update_expense_with_splits.
 *
 * amount_in_to = amount_in_from * (rateTo / rateFrom), with the trivial case rateFrom === rateTo
 * (same currency) always returning the input unchanged regardless of rate precision noise.
 */
export function convertAmount(amount: number, rateFrom: number, rateTo: number): number {
  if (rateFrom === rateTo) return amount;
  if (rateFrom <= 0 || rateTo <= 0) {
    throw new Error('Exchange rates must be positive');
  }
  return roundCurrency(amount * (rateTo / rateFrom));
}
