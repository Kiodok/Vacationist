import { describe, it, expect } from 'vitest';
import { convertAmount } from './currencyConversion';

describe('convertAmount', () => {
  it('returns the input unchanged when rates are identical (same currency)', () => {
    expect(convertAmount(42.5, 1, 1)).toBe(42.5);
    expect(convertAmount(100, 0.92, 0.92)).toBe(100);
  });

  it('converts EUR to USD using EUR-relative rates', () => {
    // rate[EUR] = 1, rate[USD] = 1.08 → 1 EUR = 1.08 USD
    expect(convertAmount(100, 1, 1.08)).toBeCloseTo(108, 2);
  });

  it('converts USD to EUR (inverse direction)', () => {
    expect(convertAmount(108, 1.08, 1)).toBeCloseTo(100, 2);
  });

  it('cross-converts between two non-EUR currencies via EUR-relative rates', () => {
    // rate[GBP] = 0.86, rate[USD] = 1.08 → 1 GBP = (1.08 / 0.86) USD
    const result = convertAmount(100, 0.86, 1.08);
    expect(result).toBeCloseTo(125.58, 1);
  });

  it('rounds the result to 2 decimal places', () => {
    const result = convertAmount(33.33, 1, 1.0837);
    const decimals = result.toString().includes('.') ? result.toString().split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });

  it('throws for a non-positive rate', () => {
    expect(() => convertAmount(10, 0, 1)).toThrow();
    expect(() => convertAmount(10, 1, -1)).toThrow();
  });

  it('handles a zero amount', () => {
    expect(convertAmount(0, 1, 1.08)).toBe(0);
  });
});
