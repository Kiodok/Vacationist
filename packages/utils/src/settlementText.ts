import type { MemberBalance, Currency, User } from '@vacationist/types';
import type { Settlement } from './settlements';
import { formatCurrency, isNegligible } from './format';

export interface SettlementTextInput {
  balances: MemberBalance[];
  settlements: Settlement[];
  members: Map<string, User>;
  currency: Currency;
  tripId: string;
  tripTitle: string;
}

export function formatSettlementShareText(input: SettlementTextInput): string {
  const { balances, settlements, members, currency, tripId, tripTitle } = input;
  const lines: string[] = [];

  lines.push(`💰 Balances & Settlements — "${tripTitle}"`);
  lines.push('');
  lines.push('📊 Member Balances:');

  for (const b of balances) {
    const name = members.get(b.user_id)?.name ?? 'Unknown';
    const net = b.net_balance;
    const prefix = !isNegligible(net) && net > 0 ? '+' : '';
    lines.push(
      `  ${name}: ${prefix}${formatCurrency(net, currency)}` +
        ` (paid: ${formatCurrency(b.total_paid, currency)}, owes: ${formatCurrency(b.total_owed, currency)})`,
    );
  }

  lines.push('');

  if (settlements.length === 0) {
    lines.push('✅ All settled up! No payments needed.');
  } else {
    lines.push('💸 Simplified Settlements:');
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
