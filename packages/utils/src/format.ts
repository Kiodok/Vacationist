import type { Currency } from '@vacationist/types';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '\u20AC',
  CHF: 'CHF',
  USD: '$',
};

// Set once at app startup (and on locale change) via setDefaultFormatLocale.
// Kept as a module-level variable so call sites don't need to pass locale on every call.
let _defaultFormatLocale = 'en-US';

export function setDefaultFormatLocale(bcp47Locale: string): void {
  _defaultFormatLocale = bcp47Locale;
}

export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOLS[currency];
}

export function formatCurrency(amount: number, currency: Currency, locale?: string): string {
  const resolvedLocale = locale ?? _defaultFormatLocale;
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
