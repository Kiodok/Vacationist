import type { Currency, User } from '@vacationist/types';
import type { Settlement } from './settlements';
import { formatCurrency } from './format';
import { convertAmount, type CurrencyRateMap } from './currencyConversion';
import { dayjs } from './dayjs';

export interface SettlementTextInput {
  settlements: Settlement[];
  members: Map<string, User>;
  currency: Currency;
  tripId: string;
  tripTitle: string;
}

export function formatSettlementShareText(input: SettlementTextInput): string {
  const { settlements, members, currency, tripId, tripTitle } = input;
  const lines: string[] = [];

  lines.push(`💰 Settlements — "${tripTitle}"`);
  lines.push('');

  if (settlements.length === 0) {
    lines.push('✅ All settled up! No payments needed.');
  } else {
    lines.push('💸 Who pays whom:');
    for (const s of settlements) {
      const from = members.get(s.from)?.name ?? 'Unknown';
      const to = members.get(s.to)?.name ?? 'Unknown';
      lines.push(`  ${from} → ${to}: ${formatCurrency(s.amount, currency)}`);
    }
    lines.push('');
    const count = settlements.length;
    lines.push(`✅ ${count} ${count === 1 ? 'payment' : 'payments'} to settle all debts`);
  }

  lines.push('');
  lines.push(`🔗 https://web.vacationist.app/trip/${tripId}?tab=Expenses`);

  return lines.join('\n');
}

export interface BusinessExpenseDocumentRef {
  fileName: string;
  /** A signed URL — callers embedding this in a file the user keeps should mint it with a long TTL. */
  url: string;
}

/**
 * A single business-flagged cost, from ANY source table (expenses, accommodations, transfer
 * flights/rentals/public transport) — normalized to one shape before it ever reaches the report
 * builder below. Each source carries its own currency (item 12 gave transfers their own
 * `currency` column, independent of the trip's `base_currency`), so `currency` is per-item, not
 * assumed to match the report's display currency.
 */
export interface BusinessCostItem {
  /** ISO date/timestamp — formatted for display inside buildBusinessExpenseReport. */
  date: string;
  title: string;
  amount: number;
  currency: Currency;
  /** `paid_by` for an expense, `created_by` for every other source (they have no separate payer concept). */
  paidByOrCreatedBy: string;
  documents: BusinessExpenseDocumentRef[];
}

export interface MergedBusinessCostItem {
  date: string;
  title: string;
  /** In the report's display currency. */
  convertedAmount: number;
  originalAmount: number;
  originalCurrency: Currency;
  paidByOrCreatedBy: string;
  documents: BusinessExpenseDocumentRef[];
}

/**
 * Converts every item into one common display currency, using the same EUR-relative
 * cross-rate math as `useCurrencyConversion` (`convertAmount`). An item whose currency (or the
 * report currency itself) has no entry in `rates` is dropped from the result entirely — never
 * silently coerced to 0 or left unconverted, which would make the report's total confidently
 * wrong. Callers should surface `items.length !== result.length` to the user (e.g. "N amounts
 * excluded — exchange rate unavailable") rather than treating a shorter result as success.
 */
export function mergeCostItemsForReport(
  items: BusinessCostItem[],
  rates: CurrencyRateMap,
  reportCurrency: Currency,
): MergedBusinessCostItem[] {
  const merged: MergedBusinessCostItem[] = [];

  for (const item of items) {
    let convertedAmount: number;
    if (item.currency === reportCurrency) {
      convertedAmount = item.amount;
    } else {
      const rateFrom = rates[item.currency];
      const rateTo = rates[reportCurrency];
      if (rateFrom == null || rateTo == null) continue;
      convertedAmount = convertAmount(item.amount, rateFrom, rateTo);
    }
    merged.push({
      date: item.date,
      title: item.title,
      convertedAmount,
      originalAmount: item.amount,
      originalCurrency: item.currency,
      paidByOrCreatedBy: item.paidByOrCreatedBy,
      documents: item.documents,
    });
  }

  return merged;
}

/** Escapes a value for safe placement inside a GFM table cell (pipes and line breaks). */
function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export interface BusinessExpenseRow {
  /** Already formatted for display (`dayjs().format('ll')`). */
  date: string;
  title: string;
  /** Already formatted for display (`formatCurrency`) — includes a parenthesized original-currency amount when it differs from the report currency. */
  amount: string;
  paidBy: string;
  documents: BusinessExpenseDocumentRef[];
}

export interface BusinessExpenseReport {
  tripTitle: string;
  rows: BusinessExpenseRow[];
  /** Already formatted for display. Summed from raw converted amounts, never from already-rounded display strings. */
  total: string;
  count: number;
}

export interface BuildBusinessExpenseReportInput {
  /** Already merged into one currency via mergeCostItemsForReport. */
  items: MergedBusinessCostItem[];
  members: Map<string, User>;
  /** Report display currency — must match the `reportCurrency` passed to mergeCostItemsForReport. */
  currency: Currency;
  tripTitle: string;
}

/**
 * Single source of truth for how a business-cost line is presented (date format, currency,
 * payer lookup, total). Both the Markdown renderer below and the PDF Edge Function payload
 * (apps/mobile/app/trip/[id]/expenses.tsx) are built from this one report object, so the two
 * exports can never disagree on formatting — callers build the report once and pass it to both.
 */
export function buildBusinessExpenseReport(input: BuildBusinessExpenseReportInput): BusinessExpenseReport {
  const { items, members, currency, tripTitle } = input;

  const rows: BusinessExpenseRow[] = items.map((item) => ({
    date: dayjs(item.date).format('ll'),
    title: item.title,
    amount: item.originalCurrency === currency
      ? formatCurrency(item.convertedAmount, currency)
      : `${formatCurrency(item.convertedAmount, currency)} (${formatCurrency(item.originalAmount, item.originalCurrency)})`,
    paidBy: members.get(item.paidByOrCreatedBy)?.name ?? 'Unknown',
    documents: item.documents,
  }));

  const totalNum = items.reduce((sum, item) => sum + item.convertedAmount, 0);

  return {
    tripTitle,
    rows,
    total: formatCurrency(totalNum, currency),
    count: items.length,
  };
}

/** Markdown itemized report of business/company-flagged costs (table + document links), for handing in to an employer as a real .md file. Takes an already-built report — see buildBusinessExpenseReport. */
export function formatBusinessExpenseSummary(report: BusinessExpenseReport): string {
  const lines: string[] = [];

  lines.push(`# Business Expenses — ${report.tripTitle}`);
  lines.push('');

  if (report.rows.length === 0) {
    lines.push('No business expenses recorded.');
    return lines.join('\n');
  }

  lines.push('| Date | Title | Amount | Paid By | Documents |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const row of report.rows) {
    const docsCell = row.documents.length > 0
      ? row.documents.map((d) => `[${escapeTableCell(d.fileName)}](${d.url})`).join('<br>')
      : '—';
    lines.push(
      `| ${row.date} | ${escapeTableCell(row.title)} | ${row.amount} | ${escapeTableCell(row.paidBy)} | ${docsCell} |`,
    );
  }
  lines.push('');

  lines.push(`**Total (${report.count} ${report.count === 1 ? 'expense' : 'expenses'}): ${report.total}**`);

  return lines.join('\n');
}
