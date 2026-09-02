import type { Currency, User, Expense } from '@vacationist/types';
import type { Settlement } from './settlements';
import { formatCurrency } from './format';
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

export interface BusinessExpenseSummaryInput {
  /** Whole-trip expense list — filtered internally to `is_business === true`, so callers can pass the unfiltered set. */
  expenses: Expense[];
  members: Map<string, User>;
  currency: Currency;
  tripTitle: string;
  /** Signed document links per expense id, if fetched — an expense missing from this map (or an empty array) renders "—". */
  documentsByExpenseId?: Map<string, BusinessExpenseDocumentRef[]>;
}

/** Escapes a value for safe placement inside a GFM table cell (pipes and line breaks). */
function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export interface BusinessExpenseRow {
  /** Already formatted for display (`dayjs().format('ll')`). */
  date: string;
  title: string;
  /** Already formatted for display (`formatCurrency`). */
  amount: string;
  paidBy: string;
  documents: BusinessExpenseDocumentRef[];
}

export interface BusinessExpenseReport {
  tripTitle: string;
  rows: BusinessExpenseRow[];
  /** Already formatted for display. */
  total: string;
  count: number;
}

/**
 * Single source of truth for how a business-expense line is presented (date format, currency,
 * payer lookup, total). Both the Markdown renderer below and the PDF Edge Function payload
 * (apps/mobile/app/trip/[id]/expenses.tsx) are built from this, so the two exports can never
 * disagree on formatting.
 */
export function buildBusinessExpenseReport(input: BusinessExpenseSummaryInput): BusinessExpenseReport {
  const { expenses, members, currency, tripTitle, documentsByExpenseId } = input;
  const businessExpenses = expenses.filter((e) => e.is_business);

  const rows: BusinessExpenseRow[] = businessExpenses.map((e) => ({
    date: dayjs(e.created_at).format('ll'),
    title: e.title,
    amount: formatCurrency(Number(e.converted_amount), currency),
    paidBy: members.get(e.paid_by)?.name ?? 'Unknown',
    documents: documentsByExpenseId?.get(e.id) ?? [],
  }));

  const totalNum = businessExpenses.reduce((sum, e) => sum + Number(e.converted_amount), 0);

  return {
    tripTitle,
    rows,
    total: formatCurrency(totalNum, currency),
    count: businessExpenses.length,
  };
}

/** Markdown itemized report of business/company-flagged expenses (table + document links), for handing in to an employer as a real .md file. */
export function formatBusinessExpenseSummary(input: BusinessExpenseSummaryInput): string {
  const report = buildBusinessExpenseReport(input);
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
