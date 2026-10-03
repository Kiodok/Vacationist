import type { MemberBalance } from '@vacationist/types';
import { isNegligible, roundCurrency } from './format';

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export function computeSettlements(balances: MemberBalance[]): Settlement[] {
  const creditors: { userId: string; amount: number }[] = [];
  const debtors: { userId: string; amount: number }[] = [];

  for (const b of balances) {
    if (!isNegligible(b.net_balance) && b.net_balance > 0) {
      creditors.push({ userId: b.user_id, amount: b.net_balance });
    } else if (!isNegligible(b.net_balance) && b.net_balance < 0) {
      debtors.push({ userId: b.user_id, amount: Math.abs(b.net_balance) });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const transfer = Math.min(creditors[ci].amount, debtors[di].amount);
    const rounded = roundCurrency(transfer);
    if (rounded > 0) {
      settlements.push({
        from: debtors[di].userId,
        to: creditors[ci].userId,
        amount: rounded,
      });
    }
    creditors[ci].amount -= transfer;
    debtors[di].amount -= transfer;

    if (isNegligible(creditors[ci].amount)) ci++;
    if (isNegligible(debtors[di].amount)) di++;
  }

  return settlements;
}

export function isExpenseFullySettled(splits: { user_id: string; status: string }[], paidBy: string): boolean {
  const nonPayer = splits.filter((s) => s.user_id !== paidBy);
  return nonPayer.length > 0 && nonPayer.every((s) => s.status === 'settled');
}

/**
 * v1.39.2 task 2: true as soon as ANY non-payer split is settled — deliberately broader
 * than `isExpenseFullySettled` (which requires ALL of them). This is the lock condition
 * for amount/currency/tip/paid_by/split_method/split-among in EditExpenseSheet: a partial
 * settlement must not be silently reset to 'open' by an unrelated metadata edit either.
 */
export function hasAnySettledSplit(splits: { user_id: string; status: string }[], paidBy: string): boolean {
  return splits.some((s) => s.user_id !== paidBy && s.status === 'settled');
}
