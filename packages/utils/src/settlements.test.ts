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

  // ── 4-person scenarios ────────────────────────────────────────────────────

  it('4-person: single payer, 4 owers', () => {
    const balances = [
      balance('a', 400, 100),
      balance('b', 0, 100),
      balance('c', 0, 100),
      balance('d', 0, 100),
    ];
    const result = computeSettlements(balances);
    expect(result).toHaveLength(3);
    expect(result.every((s) => s.to === 'a')).toBe(true);
    const total = result.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBeCloseTo(300, 1);
  });

  it('4-person: two payers, two owers', () => {
    const balances = [
      balance('a', 200, 100),
      balance('b', 200, 100),
      balance('c', 0, 100),
      balance('d', 0, 100),
    ];
    const result = computeSettlements(balances);
    expect(result).toHaveLength(2);
    const total = result.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBeCloseTo(200, 1);
  });

  it('4-person: chain debt with unequal amounts (A+100, B+20, C-60, D-60)', () => {
    const balances = [
      balance('A', 100, 0),
      balance('B',  20, 0),
      balance('C',   0, 60),
      balance('D',   0, 60),
    ];
    const result = computeSettlements(balances);
    expect(result).toHaveLength(3);
    const total = result.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBeCloseTo(120, 1);
  });

  // ── 5-person scenarios ────────────────────────────────────────────────────

  it('5-person: one big payer', () => {
    const balances = [
      balance('a', 400, 0),
      balance('b', 0, 100),
      balance('c', 0, 100),
      balance('d', 0, 100),
      balance('e', 0, 100),
    ];
    const result = computeSettlements(balances);
    expect(result).toHaveLength(4);
    expect(result.every((s) => s.to === 'a')).toBe(true);
  });

  it('5-person: multiple payers, multiple owers (A+150, B+50, C-80, D-70, E-50)', () => {
    const balances = [
      { user_id: 'A', total_paid: 150, total_owed: 0, net_balance: 150 },
      { user_id: 'B', total_paid:  50, total_owed: 0, net_balance:  50 },
      { user_id: 'C', total_paid:   0, total_owed: 0, net_balance: -80 },
      { user_id: 'D', total_paid:   0, total_owed: 0, net_balance: -70 },
      { user_id: 'E', total_paid:   0, total_owed: 0, net_balance: -50 },
    ];
    const result = computeSettlements(balances);
    expect(result).toHaveLength(3);
    const total = result.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBeCloseTo(200, 1);
  });

  it('5-person: all negligible balances → no settlements', () => {
    const balances = [
      { user_id: 'a', total_paid: 50, total_owed: 50, net_balance: 0.005 },
      { user_id: 'b', total_paid: 50, total_owed: 50, net_balance: -0.005 },
      { user_id: 'c', total_paid: 50, total_owed: 50, net_balance: 0.001 },
      { user_id: 'd', total_paid: 50, total_owed: 50, net_balance: -0.001 },
      { user_id: 'e', total_paid: 50, total_owed: 50, net_balance: 0 },
    ];
    expect(computeSettlements(balances)).toHaveLength(0);
  });

  it('5-person: all debtors except one (sole creditor)', () => {
    const balances = [
      { user_id: 'E', total_paid: 110, total_owed: 0, net_balance: 110 },
      balance('a', 0, 50),
      balance('b', 0, 30),
      balance('c', 0, 20),
      balance('d', 0, 10),
    ];
    const result = computeSettlements(balances);
    expect(result).toHaveLength(4);
    expect(result.every((s) => s.to === 'E')).toBe(true);
  });

  it('5-person: two creditors, three debtors (A+200, B+100, C-120, D-100, E-80)', () => {
    const balances = [
      { user_id: 'A', total_paid: 200, total_owed: 0, net_balance: 200 },
      { user_id: 'B', total_paid: 100, total_owed: 0, net_balance: 100 },
      { user_id: 'C', total_paid:   0, total_owed: 0, net_balance: -120 },
      { user_id: 'D', total_paid:   0, total_owed: 0, net_balance: -100 },
      { user_id: 'E', total_paid:   0, total_owed: 0, net_balance: -80 },
    ];
    const result = computeSettlements(balances);
    const total = result.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBeCloseTo(300, 1);
    result.forEach((s) => expect(s.from).not.toBe(s.to));
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('empty input returns empty settlements', () => {
    expect(computeSettlements([])).toEqual([]);
  });

  it('exactly equal and opposite (A+99.99, B-99.99)', () => {
    const balances = [
      { user_id: 'a', total_paid: 99.99, total_owed: 0, net_balance: 99.99 },
      { user_id: 'b', total_paid: 0, total_owed: 99.99, net_balance: -99.99 },
    ];
    const result = computeSettlements(balances);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBeCloseTo(99.99, 2);
  });

  it('floating point 3-way split of €100 rounds correctly', () => {
    const balances = [
      { user_id: 'a', total_paid: 100, total_owed: 33.33, net_balance: 66.67 },
      { user_id: 'b', total_paid:   0, total_owed: 33.33, net_balance: -33.33 },
      { user_id: 'c', total_paid:   0, total_owed: 33.34, net_balance: -33.34 },
    ];
    const result = computeSettlements(balances);
    result.forEach((s) => {
      const str = s.amount.toString();
      const decimals = str.includes('.') ? str.split('.')[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });

  // ── Invariant tests ───────────────────────────────────────────────────────

  it('sum invariant: total settled = sum of positive net balances', () => {
    const balances = [
      balance('a', 200, 50),
      balance('b', 150, 80),
      balance('c', 0, 70),
      balance('d', 0, 90),
      balance('e', 0, 60),
      balance('f', 10, 110),
    ];
    const result = computeSettlements(balances);
    const totalSettled = result.reduce((sum, s) => sum + s.amount, 0);
    const totalPositive = balances
      .filter((b) => b.net_balance > 0.01)
      .reduce((sum, b) => sum + b.net_balance, 0);
    expect(Math.abs(totalSettled - totalPositive)).toBeLessThan(0.05);
  });

  it('no settlement has from === to', () => {
    const balances = [
      balance('a', 100, 50),
      balance('b', 50, 80),
      balance('c', 0, 20),
    ];
    computeSettlements(balances).forEach((s) => expect(s.from).not.toBe(s.to));
  });

  it('all settlement amounts are positive', () => {
    const balances = [
      balance('a', 300, 100),
      balance('b', 0, 100),
      balance('c', 0, 100),
    ];
    computeSettlements(balances).forEach((s) => expect(s.amount).toBeGreaterThan(0));
  });

  it('8-person group: settlement count ≤ n-1 (7)', () => {
    const balances = [
      balance('a', 320, 70),
      balance('b', 160, 70),
      balance('c',  80, 70),
      balance('d', 0, 70),
      balance('e', 0, 70),
      balance('f', 0, 70),
      balance('g', 0, 70),
      balance('h', 0, 70),
    ];
    const result = computeSettlements(balances);
    expect(result.length).toBeLessThanOrEqual(7);
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

  it('returns false for empty splits array', () => {
    expect(isExpenseFullySettled([], 'payer')).toBe(false);
  });

  it('returns false when only payer split exists (self-pay edge case)', () => {
    expect(isExpenseFullySettled([{ user_id: 'payer', status: 'open' }], 'payer')).toBe(false);
  });

  it('returns true when single non-payer split is settled', () => {
    const splits = [{ user_id: 'b', status: 'settled' }];
    expect(isExpenseFullySettled(splits, 'payer')).toBe(true);
  });

  it('returns false when single non-payer split is open', () => {
    const splits = [{ user_id: 'b', status: 'open' }];
    expect(isExpenseFullySettled(splits, 'payer')).toBe(false);
  });
});
