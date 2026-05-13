import { describe, it, expect } from 'vitest';
import { computeSettlements, isExpenseFullySettled } from './settlements';
import type { MemberBalance } from '@vacationist/types';

function balance(user_id: string, total_paid: number, total_owed: number): MemberBalance {
  return { user_id, total_paid, total_owed, net_balance: total_paid - total_owed };
}

describe('computeSettlements', () => {
  it('returns empty for all-zero balances', () => {
    const balances = [
      balance('a', 50, 50),
      balance('b', 50, 50),
    ];
    expect(computeSettlements(balances)).toEqual([]);
  });

  it('returns empty when all balances are negligible', () => {
    const balances = [
      { user_id: 'a', total_paid: 50, total_owed: 50, net_balance: 0.005 },
      { user_id: 'b', total_paid: 50, total_owed: 50, net_balance: -0.005 },
    ];
    expect(computeSettlements(balances)).toEqual([]);
  });

  it('handles simple 2-person debt', () => {
    const balances = [
      balance('a', 100, 50),
      balance('b', 0, 50),
    ];
    const result = computeSettlements(balances);
    expect(result).toEqual([
      { from: 'b', to: 'a', amount: 50 },
    ]);
  });

  it('handles 3-person with one payer', () => {
    const balances = [
      balance('a', 90, 30),
      balance('b', 0, 30),
      balance('c', 0, 30),
    ];
    const result = computeSettlements(balances);
    expect(result).toHaveLength(2);
    const totalTransferred = result.reduce((sum, s) => sum + s.amount, 0);
    expect(totalTransferred).toBe(60);
    expect(result.every((s) => s.to === 'a')).toBe(true);
  });

  it('minimizes transactions with greedy matching', () => {
    const balances = [
      balance('a', 60, 30),
      balance('b', 60, 30),
      balance('c', 0, 30),
      balance('d', 0, 30),
    ];
    const result = computeSettlements(balances);
    expect(result).toHaveLength(2);
  });

  it('handles exact offset (no settlements needed)', () => {
    const balances = [
      balance('a', 50, 50),
      balance('b', 30, 30),
    ];
    expect(computeSettlements(balances)).toEqual([]);
  });

  it('handles single member', () => {
    const balances = [balance('a', 100, 100)];
    expect(computeSettlements(balances)).toEqual([]);
  });

  it('rounds settlement amounts', () => {
    const balances = [
      { user_id: 'a', total_paid: 100, total_owed: 33.33, net_balance: 66.67 },
      { user_id: 'b', total_paid: 0, total_owed: 33.33, net_balance: -33.33 },
      { user_id: 'c', total_paid: 0, total_owed: 33.34, net_balance: -33.34 },
    ];
    const result = computeSettlements(balances);
    result.forEach((s) => {
      const decimals = s.amount.toString().split('.')[1];
      expect(!decimals || decimals.length <= 2).toBe(true);
    });
  });

  it('does not mutate the input balances array', () => {
    const balances = [
      balance('a', 100, 50),
      balance('b', 0, 50),
    ];
    const original = balances.map((b) => ({ ...b }));
    computeSettlements(balances);
    expect(balances).toEqual(original);
  });
});

describe('isExpenseFullySettled', () => {
  it('returns true when all non-payer splits are settled', () => {
    const splits = [
      { user_id: 'payer', status: 'settled' },
      { user_id: 'b', status: 'settled' },
      { user_id: 'c', status: 'settled' },
    ];
    expect(isExpenseFullySettled(splits, 'payer')).toBe(true);
  });

  it('returns false when any non-payer split is open', () => {
    const splits = [
      { user_id: 'payer', status: 'settled' },
      { user_id: 'b', status: 'settled' },
      { user_id: 'c', status: 'open' },
    ];
    expect(isExpenseFullySettled(splits, 'payer')).toBe(false);
  });

  it('returns false when all splits are open', () => {
    const splits = [
      { user_id: 'payer', status: 'settled' },
      { user_id: 'b', status: 'open' },
    ];
    expect(isExpenseFullySettled(splits, 'payer')).toBe(false);
  });

  it('returns false when only payer split exists (self-pay)', () => {
    const splits = [
      { user_id: 'payer', status: 'settled' },
    ];
    expect(isExpenseFullySettled(splits, 'payer')).toBe(false);
  });

  it('handles payer status irrelevant to result', () => {
    const splits = [
      { user_id: 'payer', status: 'open' },
      { user_id: 'b', status: 'settled' },
    ];
    expect(isExpenseFullySettled(splits, 'payer')).toBe(true);
  });
});
