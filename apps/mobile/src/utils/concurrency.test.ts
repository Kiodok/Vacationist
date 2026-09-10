import { describe, it, expect } from 'vitest';
import { runWithConcurrency } from './concurrency';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('runWithConcurrency', () => {
  it('settles every task, preserving input order', async () => {
    const tasks = [10, 1, 5, 1, 8].map((ms, i) => async () => {
      await tick(ms);
      return i;
    });
    const res = await runWithConcurrency(tasks, 2);
    expect(res.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([0, 1, 2, 3, 4]);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const tasks = Array.from({ length: 12 }, () => async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await tick(5);
      inFlight--;
    });
    await runWithConcurrency(tasks, 4);
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it('surfaces a rejection as a rejected result without aborting the pool', async () => {
    const tasks = [
      async () => 'a',
      async () => {
        throw new Error('boom');
      },
      async () => 'c',
    ];
    const res = await runWithConcurrency(tasks, 2);
    expect(res[0]).toEqual({ status: 'fulfilled', value: 'a' });
    expect(res[1].status).toBe('rejected');
    expect(res[2]).toEqual({ status: 'fulfilled', value: 'c' });
  });

  it('handles an empty task list and a limit larger than the list', async () => {
    expect(await runWithConcurrency([], 4)).toEqual([]);
    const res = await runWithConcurrency([async () => 1, async () => 2], 10);
    expect(res.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([1, 2]);
  });
});
