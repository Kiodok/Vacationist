import type { Currency, User } from '@vacationist/types';
import type { Settlement } from './settlements';
import { formatCurrency } from './format';

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
