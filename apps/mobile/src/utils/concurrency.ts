/**
 * Run an array of async thunks with a bounded number in flight at once, and
 * resolve to a `Promise.allSettled`-shaped result array in the SAME order as the
 * input. A rejected task never aborts the pool.
 *
 * Used to keep bursty fan-outs (e.g. the trip offline prefetch) from firing
 * dozens of network requests + JSON parses simultaneously.
 */
export async function runWithConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results = new Array<PromiseSettledResult<T>>(tasks.length);
  const max = Math.max(1, Math.floor(limit));
  let next = 0;

  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(max, tasks.length) }, () => worker()),
  );
  return results;
}
