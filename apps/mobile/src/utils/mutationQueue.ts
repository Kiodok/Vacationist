import { dehydrate, hydrate, type QueryClient, type Mutation } from '@tanstack/react-query';
import { storage } from './mmkvStorage';
import { isPersistedMutationKey } from './queryClient';

/**
 * Offline mutation queue persistence (Phase 19).
 *
 * Previously, paused offline mutations were dehydrated *inside* the main query
 * cache blob (`REACT_QUERY_CACHE_v2`), which is discarded wholesale the moment
 * its `maxAge` lapses. A phone left off for a travel day therefore silently
 * dropped every queued change. This module keeps the queue in its own MMKV key
 * with its own, much longer, lifetime — the queue is valid until it drains, not
 * for a fixed window.
 */

const QUEUE_KEY = 'MUTATION_QUEUE_v1';
// A queued write older than this is almost certainly stale enough that replaying
// it would do more harm than good (it would clobber two weeks of other edits).
const MAX_QUEUE_AGE_MS = 14 * 24 * 60 * 60 * 1000;

interface StoredQueue {
  t: number;
  // DehydratedState['mutations'] — kept loose to avoid depending on TanStack's
  // internal dehydrated shape.
  mutations: unknown[];
}

function shouldDehydrateMutation(mutation: Mutation): boolean {
  return mutation.state.isPaused && isPersistedMutationKey(mutation.options.mutationKey?.[0]);
}

let writeScheduled = false;

/** Serialize the current paused+persisted mutations to MMKV. Debounced. */
export function persistMutationQueue(queryClient: QueryClient): void {
  if (writeScheduled) return;
  writeScheduled = true;
  setTimeout(() => {
    writeScheduled = false;
    try {
      const dehydrated = dehydrate(queryClient, {
        shouldDehydrateQuery: () => false,
        shouldDehydrateMutation,
      });
      const payload: StoredQueue = { t: Date.now(), mutations: dehydrated.mutations ?? [] };
      if (payload.mutations.length === 0) {
        storage.remove(QUEUE_KEY);
      } else {
        storage.set(QUEUE_KEY, JSON.stringify(payload));
      }
    } catch {
      // A serialization failure must never crash the app — the queue just
      // won't survive a kill this time.
    }
  }, 300);
}

/**
 * Rehydrate the queued mutations into the cache (still paused). Call once at
 * boot, AFTER `mutationDefaults` has registered — the hydrated mutations get
 * their `mutationFn` from there. Caller then runs `resumePausedMutations()`
 * when online.
 */
export function hydrateMutationQueue(queryClient: QueryClient): void {
  try {
    const raw = storage.getString(QUEUE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as StoredQueue;
    if (!parsed?.mutations?.length) return;
    if (Date.now() - parsed.t > MAX_QUEUE_AGE_MS) {
      storage.remove(QUEUE_KEY);
      return;
    }
    hydrate(queryClient, { mutations: parsed.mutations });
  } catch {
    storage.remove(QUEUE_KEY);
  }
}

/** Keep the on-disk queue in sync with the mutation cache. Returns an unsubscribe. */
export function subscribeMutationQueue(queryClient: QueryClient): () => void {
  return queryClient.getMutationCache().subscribe(() => persistMutationQueue(queryClient));
}
