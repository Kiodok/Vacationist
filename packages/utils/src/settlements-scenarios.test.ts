import { describe, it, expect } from 'vitest';
import { computeSettlements } from './settlements';
import type { MemberBalance } from '@vacationist/types';

function b(user_id: string, total_paid: number, total_owed: number): MemberBalance {
  return { user_id, total_paid, total_owed, net_balance: Math.round((total_paid - total_owed) * 100) / 100 };
}

function totalTransferred(settlements: ReturnType<typeof computeSettlements>): number {
  return Math.round(settlements.reduce((s, t) => s + t.amount, 0) * 100) / 100;
}

function totalPositiveBalance(balances: MemberBalance[]): number {
  return Math.round(balances.filter((b) => b.net_balance > 0.01).reduce((s, b) => s + b.net_balance, 0) * 100) / 100;
}

/**
 * Scenario 1: 5-person trip, 3 even-split expenses.
 * Alice pays €150 (5-way, each €30), Bob pays €100 (5-way, each €20), Charlie pays €50 (5-way, each €10).
 * Balances:
 *   Alice  = 150 - 60 = +90
 *   Bob    = 100 - 60 = +40
 *   Charlie=  50 - 60 = -10
 *   Dave   =   0 - 60 = -60
 *   Eve    =   0 - 60 = -60
 */
describe('Scenario 1: 5-person trip, 3 expenses (even split)', () => {
  const balances: MemberBalance[] = [
    b('alice',   150, 60),
    b('bob',     100, 60),
    b('charlie',  50, 60),
    b('dave',      0, 60),
    b('eve',       0, 60),
  ];

  it('produces the correct number of settlements', () => {
    const result = computeSettlements(balances);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it('total transferred equals total positive net balance (€130)', () => {
    const result = computeSettlements(balances);
    expect(totalTransferred(result)).toBeCloseTo(130, 1);
  });

  it('no self-transfers', () => {
    const result = computeSettlements(balances);
    result.forEach((s) => expect(s.from).not.toBe(s.to));
  });

  it('all settlement amounts are positive', () => {
    const result = computeSettlements(balances);
    result.forEach((s) => expect(s.amount).toBeGreaterThan(0));
  });
});

/**
 * Scenario 2: 5-person trip with a cover.
 * Alice pays €200 (4-way: A/B/C/D €50 each).
 * Bob covers Dave's €50 split → Dave owes nothing, Bob owes €100.
 * After cover:
 *   Alice = 200 - 50 = +150
 *   Bob   =   0 - 100 = -100
 *   Charlie=  0 -  50 = -50
 *   Dave  =   0 -   0 =   0
 */
describe('Scenario 2: 5-person trip with cover', () => {
  const balances: MemberBalance[] = [
    b('alice',   200, 50),
    b('bob',       0, 100),
    b('charlie',   0, 50),
    b('dave',      0, 0),
  ];

  it('produces exactly 2 settlements', () => {
    const result = computeSettlements(balances);
    expect(result).toHaveLength(2);
  });

  it('both settlements point to alice', () => {
    const result = computeSettlements(balances);
    expect(result.every((s) => s.to === 'alice')).toBe(true);
  });

  it('total transferred is €150', () => {
    const result = computeSettlements(balances);
    expect(totalTransferred(result)).toBeCloseTo(150, 1);
  });
});

/**
 * Scenario 3: Round-robin (everyone pays equally).
 * 4 people each pay €40 split 4 ways → all net = 0.
 */
describe('Scenario 3: Round-robin, everyone pays equally', () => {
  const balances: MemberBalance[] = [
    b('a', 40, 40),
    b('b', 40, 40),
    b('c', 40, 40),
    b('d', 40, 40),
  ];

  it('produces zero settlements', () => {
    expect(computeSettlements(balances)).toHaveLength(0);
  });
});

/**
 * Scenario 4: Uneven splits (exact method).
 * Alice pays €100. Bob owes €60, Charlie owes €30, Alice owes €10.
 * Balances: Alice +90, Bob -60, Charlie -30.
 */
describe('Scenario 4: Uneven exact splits', () => {
  const balances: MemberBalance[] = [
    b('alice',   100, 10),
    b('bob',       0, 60),
    b('charlie',   0, 30),
  ];

  it('Bob pays Alice €60', () => {
    const result = computeSettlements(balances);
    const bobAlice = result.find((s) => s.from === 'bob' && s.to === 'alice');
    expect(bobAlice).toBeDefined();
    expect(bobAlice!.amount).toBeCloseTo(60, 1);
  });

  it('Charlie pays Alice €30', () => {
    const result = computeSettlements(balances);
    const charlieAlice = result.find((s) => s.from === 'charlie' && s.to === 'alice');
    expect(charlieAlice).toBeDefined();
    expect(charlieAlice!.amount).toBeCloseTo(30, 1);
  });

  it('total settled is €90', () => {
    const result = computeSettlements(balances);
    expect(totalTransferred(result)).toBeCloseTo(90, 1);
  });
});

/**
 * Scenario 5: Progressive settlement (settle one pair, recompute).
 * Start: A+100, B-60, C-40.
 * After B settles (marks splits settled):
 *   A gets -60 credit, B becomes 0. New: A+40, C-40.
 */
describe('Scenario 5: Progressive settlement', () => {
  it('initial state: 2 settlements totalling 100', () => {
    const initial: MemberBalance[] = [b('A', 100, 0), b('B', 0, 60), b('C', 0, 40)];
    const result = computeSettlements(initial);
    expect(result).toHaveLength(2);
    expect(totalTransferred(result)).toBeCloseTo(100, 1);
  });

  it('after B settles: 1 remaining settlement of 40', () => {
    const afterBSettles: MemberBalance[] = [b('A', 40, 0), b('B', 0, 0), b('C', 0, 40)];
    const result = computeSettlements(afterBSettles);
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe('C');
    expect(result[0].to).toBe('A');
    expect(result[0].amount).toBeCloseTo(40, 1);
  });
});

/**
 * Scenario 6: Large group (8 people), 6 expenses.
 * 3 payers (A/B/C) and 5 non-payers (D/E/F/G/H).
 * Each payer pays different amounts split evenly among all 8.
 */
describe('Scenario 6: Large group 8-person trip', () => {
  // A pays €320 (8-way → each owes €40), B pays €160 (8-way → €20 each), C pays €80 (8-way → €10 each)
  // Total: A paid 320, owed 70 → +250; B paid 160, owed 70 → +90; C paid 80, owed 70 → +10
  // D/E/F/G/H paid 0, owed 70 each → -70
  // Total positive: 250+90+10 = 350 = Total negative: 5×70 = 350 ✓
  const balances: MemberBalance[] = [
    b('A', 320, 70),
    b('B', 160, 70),
    b('C',  80, 70),
    b('D',   0, 70),
    b('E',   0, 70),
    b('F',   0, 70),
    b('G',   0, 70),
    b('H',   0, 70),
  ];

  it('sum invariant holds: total settlements = total positive balance', () => {
    const result = computeSettlements(balances);
    const positive = totalPositiveBalance(balances);
    expect(totalTransferred(result)).toBeCloseTo(positive, 1);
  });

  it('number of settlements ≤ n-1 (7)', () => {
    const result = computeSettlements(balances);
    expect(result.length).toBeLessThanOrEqual(7);
  });

  it('no self-transfers', () => {
    computeSettlements(balances).forEach((s) => expect(s.from).not.toBe(s.to));
  });

  it('all amounts positive', () => {
    computeSettlements(balances).forEach((s) => expect(s.amount).toBeGreaterThan(0));
  });
});
