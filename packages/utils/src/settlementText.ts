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

/** Markdown itemized report of business/company-flagged expenses (table + document links), for handing in to an employer as a real .md file. */
export function formatBusinessExpenseSummary(input: BusinessExpenseSummaryInput): string {
  const { expenses, members, currency, tripTitle, documentsByExpenseId } = input;
  const businessExpenses = expenses.filter((e) => e.is_business);
  const lines: string[] = [];

  lines.push(`# Business Expenses — ${tripTitle}`);
  lines.push('');

  if (businessExpenses.length === 0) {
    lines.push('No business expenses recorded.');
    return lines.join('\n');
  }

  lines.push('| Date | Title | Amount | Paid By | Documents |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const e of businessExpenses) {
    const payer = members.get(e.paid_by)?.name ?? 'Unknown';
    const date = dayjs(e.created_at).format('ll');
    const docs = documentsByExpenseId?.get(e.id) ?? [];
    const docsCell = docs.length > 0
      ? docs.map((d) => `[${escapeTableCell(d.fileName)}](${d.url})`).join('<br>')
      : '—';
    lines.push(
      `| ${date} | ${escapeTableCell(e.title)} | ${formatCurrency(Number(e.converted_amount), currency)} | ${escapeTableCell(payer)} | ${docsCell} |`,
    );
  }
  lines.push('');

  const total = businessExpenses.reduce((sum, e) => sum + Number(e.converted_amount), 0);
  const count = businessExpenses.length;
  lines.push(`**Total (${count} ${count === 1 ? 'expense' : 'expenses'}): ${formatCurrency(total, currency)}**`);

  return lines.join('\n');
}
