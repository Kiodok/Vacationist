import { dayjs } from './dayjs';
import type { Currency } from '@vacationist/types';

// Currency is DB-driven (public.currency_catalog) as of Phase 15, so this can no longer be a
// total Record over every possible code \u2014 it's a display nicety for the handful of
// currencies whose symbol Intl-less fallback rendering cares about; anything else falls back
// to the ISO code itself (see getCurrencySymbol/formatCurrency below).
const CURRENCY_SYMBOLS: Partial<Record<string, string>> = {
  EUR: '\u20AC',
  CHF: 'CHF',
  USD: '$',
  GBP: '\u00A3',
};

// Set once at app startup (and on locale change) via setDefaultFormatLocale.
// Kept as a module-level variable so call sites don't need to pass locale on every call.
let _defaultFormatLocale = 'en-US';

export function setDefaultFormatLocale(bcp47Locale: string): void {
  _defaultFormatLocale = bcp47Locale;
}

export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

export function formatCurrency(amount: number, currency: Currency, locale?: string): string {
  const resolvedLocale = locale ?? _defaultFormatLocale;
  try {
    return new Intl.NumberFormat(resolvedLocale, { style: 'currency', currency }).format(amount);
  } catch {
    // Fallback for environments that don't support Intl (or an ISO code Intl doesn't
    // recognize) — a plain "CODE amount" is unambiguous for any currency, known or not.
    const symbol = getCurrencySymbol(currency);
    const formatted = amount.toFixed(2);
    return symbol === currency ? `${currency} ${formatted}` : symbol === 'CHF' ? `${symbol} ${formatted}` : `${symbol}${formatted}`;
  }
}

export const BALANCE_THRESHOLD = 0.01;

export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function isNegligible(amount: number): boolean {
  return Math.abs(amount) < BALANCE_THRESHOLD;
}

/**
 * Formats a transfer timestamp (transfer_flights/transfer_rentals/transfer_public_transport'
 * departure_time/arrival_time/pickup_date/dropoff_date) — TIMESTAMPTZ columns that, by this
 * codebase's convention, store the literal wall-clock digits the user typed with NO real UTC
 * conversion (CreateFlightSheet/CreatePublicTransportSheet build them as bare `${date}T${time}`
 * strings, which Postgres then labels with a UTC offset it never actually meant). Reading them
 * back with a bare `dayjs(value)` parse-then-format applies a *real* UTC → device-local
 * conversion, shifting the displayed time by the viewer's device UTC offset — this is the
 * "Switzerland vs. the other country" timezone-hour bug (task 13). The only correct read is to
 * treat the UTC label as inert and re-extract the original digits verbatim via `dayjs.utc(...)`
 * (parse as UTC, format without converting to local) — never `.tz(...)` or a bare `dayjs(...)`.
 */
export function formatNaiveTimestamp(value: string | null | undefined, formatStr: string): string | null {
  if (!value) return null;
  const d = dayjs.utc(value.replace(' ', 'T'));
  if (!d.isValid()) return null;
  return d.format(formatStr);
}

export function normalizeBalance(amount: number): number {
  return isNegligible(amount) ? 0 : roundCurrency(amount);
}

/**
 * Cleans free-typed decimal input for a numeric TextInput: accepts "," as an
 * alternate decimal separator (so locale keyboards that produce "," work the
 * same as "."), strips anything else non-numeric, collapses extra separators
 * down to the first one, and truncates the fraction to maxDecimals.
 */
export function sanitizeDecimalInput(text: string, maxDecimals = 2): string {
  return text
    .replaceAll(',', '.')
    .replace(/[^0-9.]/g, '')
    .replace(/(\..*)\./g, '$1')
    .replace(new RegExp(String.raw`(\.\d{${maxDecimals}}).+`), '$1');
}

/**
 * Formats a trip's date-only start/end range (`trips.start_date`/`end_date`, plain
 * 'YYYY-MM-DD' strings, no time component). A bare `dayjs(dateString)` parses a date-only ISO
 * string as UTC midnight, then `.format()` renders it in the *device's* local timezone — on any
 * device behind UTC this rolls the displayed date back a day (the same class of bug fixed in
 * ActivityCard.tsx for task 12). Pass `timezone` (the trip's own) when available to parse via
 * `.tz()` instead; when it isn't (e.g. the pre-join invite preview, which has no timezone field),
 * `.utc()` is an equally correct fallback — for a value with no time-of-day, both simply avoid
 * ever converting to device-local, so the displayed date always matches the stored digits
 * regardless of which one is used.
 */
export function formatDateRange(start: string, end: string, timezone?: string): string {
  const s = timezone ? dayjs.tz(start, timezone) : dayjs.utc(start);
  const e = timezone ? dayjs.tz(end, timezone) : dayjs.utc(end);
  if (s.year() !== e.year()) return `${s.format('D MMM YYYY')} – ${e.format('D MMM YYYY')}`;
  if (s.month() !== e.month()) return `${s.format('D MMM')} – ${e.format('D MMM YYYY')}`;
  return `${s.format('D')} – ${e.format('D MMM YYYY')}`;
}
