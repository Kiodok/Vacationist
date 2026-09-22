import { describe, it, expect } from 'vitest';
import {
  evenSplitAmounts,
  storedExactShares,
  evenExactShares,
  sumExactAmounts,
  isExactSplitBalanced,
} from './expenseSplits';

describe('evenSplitAmounts', () => {
  it('always sums to the total to the cent, remainder on the last share', () => {
    expect(evenSplitAmounts(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(evenSplitAmounts(165, 2)).toEqual([82.5, 82.5]);
    for (const [total, n] of [[0.05, 3], [99.99, 7], [1234.56, 11]] as const) {
      const sum = evenSplitAmounts(total, n).reduce((a, b) => a + b, 0);
      expect(Math.round(sum * 100)).toBe(Math.round(total * 100));
    }
  });
  it('handles an empty group', () => {
    expect(evenSplitAmounts(10, 0)).toEqual([]);
  });
});

describe('storedExactShares', () => {
  it('uses the base-currency share for a base-currency expense', () => {
    expect(storedExactShares([{ user_id: 'a', amount_owed: '150', amount_owed_original_currency: null }])).toEqual({ a: '150.00' });
  });
  it('prefers the expense-currency share for a foreign-currency expense (the Exp-8 regression)', () => {
    // 165 USD split 150/15, stored in EUR at 0.9: amount_owed is 135/13.5, original is 150/15.
    expect(
      storedExactShares([
        { user_id: 'a', amount_owed: 135, amount_owed_original_currency: 150 },
        { user_id: 'b', amount_owed: 13.5, amount_owed_original_currency: 15 },
      ]),
    ).toEqual({ a: '150.00', b: '15.00' });
  });
});

describe('evenExactShares / sumExactAmounts', () => {
  it('seeds a balanced split when switching an even expense to exact', () => {
    const seeded = evenExactShares(['a', 'b', 'c'], 100);
    expect(sumExactAmounts(['a', 'b', 'c'], seeded)).toBe(100);
  });
  it('ignores blanks and junk', () => {
    expect(sumExactAmounts(['a', 'b'], { a: '10', b: '' })).toBe(10);
  });
});

describe('isExactSplitBalanced', () => {
  it('requires the shares to reach the total (Add/Save is disabled otherwise)', () => {
    expect(isExactSplitBalanced(165, 2, 165)).toBe(true);
    expect(isExactSplitBalanced(165, 2, 150)).toBe(false);
    expect(isExactSplitBalanced(165, 2, 165.004)).toBe(true);
  });
  it('a single member always matches, but nothing to save without a total', () => {
    expect(isExactSplitBalanced(50, 1, 0)).toBe(true);
    expect(isExactSplitBalanced(0, 2, 0)).toBe(false);
  });
});
