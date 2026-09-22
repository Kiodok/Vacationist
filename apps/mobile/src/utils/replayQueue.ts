import { refreshSessionQuietly } from '@vacationist/api';
import { queryClient } from './queryClient';

/** Longest we'll hold the replay back waiting for a session refresh. */
const REFRESH_WAIT_MS = 8000;

function hasPausedMutations(): boolean {
  return queryClient.getMutationCache().getAll().some((m) => m.state.isPaused);
}

/**
 * Refresh the session, THEN replay the offline queue, THEN refetch everything.
 *
 * The order is the point. Both call sites (boot and offline→online) used to start the replay
 * without waiting for the refresh — `NetworkProvider` fired `void refreshSessionQuietly()` and
 * carried straight on, and `QueryProvider` didn't refresh at all. A replay that starts while the
 * access token is expired or the network is only just usable can fall back to the anon key and be
 * rejected by RLS with a *non-network* error — which fails the mutation permanently instead of
 * leaving it paused for another attempt.
 *
 * (supabase-js also refreshes inside its own fetch wrapper, so this is a defensive ordering fix,
 * not a proven root cause — it removes the race rather than diagnosing one.)
 *
 * The wait is bounded so a flaky connection can't stall the replay: `refreshSessionQuietly` never
 * rejects, but it can be slow.
 *
 * @param refresh `'always'` (reconnect — also advances the offline-trust window's "last verified"
 *   stamp) or `'if-queued'` (boot — don't spend a network round trip when there's nothing to replay).
 */
export async function refreshAndResumeMutations(refresh: 'always' | 'if-queued'): Promise<void> {
  if (refresh === 'always' || hasPausedMutations()) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      refreshSessionQuietly(),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, REFRESH_WAIT_MS); }),
    ]);
    if (timer) clearTimeout(timer);
  }
  try {
    await queryClient.resumePausedMutations();
  } finally {
    // Refetch even if a replay threw — the rest of the cache is still stale.
    void queryClient.invalidateQueries();
  }
}
