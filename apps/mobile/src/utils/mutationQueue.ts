import { AppState } from 'react-native';
import { dehydrate, hydrate, type QueryClient, type Mutation } from '@tanstack/react-query';
import { storage } from './mmkvStorage';
import { isPersistedMutationKey } from './queryClient';
import { reapplyOptimisticRows } from './optimisticRehydrate';
import { useAuthStore } from '../stores/authStore';

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

/** Serialize the current paused+persisted mutations to MMKV, right now. */
function writeQueueNow(queryClient: QueryClient): void {
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
}

/** Serialize the current paused+persisted mutations to MMKV. Debounced. */
export function persistMutationQueue(queryClient: QueryClient): void {
  if (writeScheduled) return;
  writeScheduled = true;
  setTimeout(() => {
    writeScheduled = false;
    writeQueueNow(queryClient);
  }, 300);
}

/**
 * Write the queue immediately, bypassing the 300 ms debounce. A change queued and then a hard kill
 * inside that window would otherwise be lost — the queue would come back one change short.
 */
export function flushMutationQueue(queryClient: QueryClient): void {
  writeScheduled = false; // a pending debounced write is now redundant
  writeQueueNow(queryClient);
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
    return;
  }

  // The queue survived, but the optimistic rows it produced did not (stripOptimisticRows removes
  // them before the query cache is written) — put them back so offline changes stay visible after a
  // restart. Deliberately OUTSIDE the try/catch above: that catch treats any throw as a corrupt
  // queue and deletes it, and a bug in a rehydrator must never cost the user their pending changes.
  try {
    reapplyOptimisticRows(queryClient, () => useAuthStore.getState().user?.id ?? '');
  } catch {
    // Cosmetic only — the mutations still replay on reconnect.
  }
}

/**
 * Keep the on-disk queue in sync with the mutation cache — debounced on every change, plus an
 * immediate flush when the app leaves the foreground (the last chance before a kill). Returns an
 * unsubscribe.
 */
export function subscribeMutationQueue(queryClient: QueryClient): () => void {
  const unsubscribeCache = queryClient.getMutationCache().subscribe(() => persistMutationQueue(queryClient));
  const appState = AppState.addEventListener('change', (state) => {
    if (state !== 'active') flushMutationQueue(queryClient);
  });
  return () => {
    unsubscribeCache();
    appState.remove();
  };
}
