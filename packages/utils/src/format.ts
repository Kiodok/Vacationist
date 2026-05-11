import type { Currency } from '@vacationist/types';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '\u20AC',
  CHF: 'CHF',
};

export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = amount.toFixed(2);
  return currency === 'CHF' ? `${symbol} ${formatted}` : `${symbol}${formatted}`;
}
