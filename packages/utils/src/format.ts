import type { Currency } from '@vacationist/types';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '\u20AC',
  CHF: 'CHF',
};

export function formatCurrency(amount: number, currency: Currency, locale?: string): string {
  const resolvedLocale = locale ?? 'en-US';
  try {
    return new Intl.NumberFormat(resolvedLocale, { style: 'currency', currency }).format(amount);
  } catch {
    // Fallback for environments that don't support Intl
    const symbol = CURRENCY_SYMBOLS[currency];
    const formatted = amount.toFixed(2);
    return currency === 'CHF' ? `${symbol} ${formatted}` : `${symbol}${formatted}`;
  }
}

export const BALANCE_THRESHOLD = 0.01;

export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function isNegligible(amount: number): boolean {
  return Math.abs(amount) < BALANCE_THRESHOLD;
}

export function normalizeBalance(amount: number): number {
  return isNegligible(amount) ? 0 : roundCurrency(amount);
}
