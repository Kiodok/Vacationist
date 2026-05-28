import { describe, it, expect } from 'vitest';
import { formatCurrency, roundCurrency, isNegligible, normalizeBalance, BALANCE_THRESHOLD } from './format';

describe('formatCurrency', () => {
  it('formats EUR with euro symbol prefix', () => {
    expect(formatCurrency(42.5, 'EUR')).toBe('€42.50');
  });

  it('formats CHF with CHF prefix and the amount', () => {
    const result = formatCurrency(42.5, 'CHF');
    expect(result).toMatch(/CHF/);
    expect(result).toMatch(/42\.50/);
  });

  it('formats zero', () => {
    expect(formatCurrency(0, 'EUR')).toMatch(/€.*0\.00|0\.00.*€/);
  });

  it('formats negative amounts (contains minus and absolute value)', () => {
    const result = formatCurrency(-15.3, 'EUR');
    expect(result).toContain('-');
    expect(result).toMatch(/15\.30/);
    expect(result).toMatch(/€/);
  });

  it('rounds to 2 decimal places in display', () => {
    expect(formatCurrency(10.999, 'EUR')).toMatch(/11\.00/);
    expect(formatCurrency(10.994, 'EUR')).toMatch(/10\.99/);
  });

  it('handles large amounts (contains CHF and the correct value)', () => {
    const result = formatCurrency(99999.99, 'CHF');
    expect(result).toMatch(/CHF/);
    expect(result).toMatch(/99[,\s.]?999\.99/);
  });
});

describe('roundCurrency', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundCurrency(10.456)).toBe(10.46);
    expect(roundCurrency(10.454)).toBe(10.45);
  });

  it('handles exact values', () => {
    expect(roundCurrency(10.00)).toBe(10.00);
    expect(roundCurrency(10.1)).toBe(10.1);
  });

  it('rounds 0.5 up (banker-style)', () => {
    expect(roundCurrency(10.005)).toBe(10.01);
  });

  it('handles negative values', () => {
    expect(roundCurrency(-5.678)).toBe(-5.68);
  });

  it('handles zero', () => {
    expect(roundCurrency(0)).toBe(0);
  });

  it('handles classic floating-point: 0.1 + 0.2', () => {
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
  });
});

describe('isNegligible', () => {
  it('returns true for zero', () => {
    expect(isNegligible(0)).toBe(true);
  });

  it('returns true for amounts below threshold', () => {
    expect(isNegligible(0.009)).toBe(true);
    expect(isNegligible(0.005)).toBe(true);
    expect(isNegligible(-0.009)).toBe(true);
  });

  it('returns false for threshold or above', () => {
    expect(isNegligible(0.01)).toBe(false);
    expect(isNegligible(0.02)).toBe(false);
    expect(isNegligible(-0.01)).toBe(false);
  });

  it('returns false for normal amounts', () => {
    expect(isNegligible(1)).toBe(false);
    expect(isNegligible(-50)).toBe(false);
  });
});

describe('normalizeBalance', () => {
  it('zeroes negligible amounts', () => {
    expect(normalizeBalance(0.005)).toBe(0);
    expect(normalizeBalance(-0.003)).toBe(0);
  });

  it('rounds non-negligible amounts', () => {
    expect(normalizeBalance(10.456)).toBe(10.46);
    expect(normalizeBalance(-5.678)).toBe(-5.68);
  });

  it('passes through clean values', () => {
    expect(normalizeBalance(25.00)).toBe(25.00);
  });
});

describe('BALANCE_THRESHOLD', () => {
  it('is 0.01', () => {
    expect(BALANCE_THRESHOLD).toBe(0.01);
  });
});
