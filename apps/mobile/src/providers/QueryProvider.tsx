import { focusManager, onlineManager } from '@tanstack/react-query';
import { getInitialOnlineStatus } from '../hooks/netInfoUtils';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import type { ReactNode } from 'react';
import Constants from 'expo-constants';
import { mmkvStorageAdapter } from '../utils/mmkvStorage';
import { stripOptimisticRows } from '../utils/persistOptimistic';
import { queryClient } from '../utils/queryClient';
import { hydrateMutationQueue, subscribeMutationQueue } from '../utils/mutationQueue';
import '../utils/mutationDefaults';

// Bump the persisted cache automatically whenever the app version changes, so a
// build that changed a query's shape gets one clean refetch instead of
// rehydrating a mismatched blob (this used to require hand-bumping the persister
// key — see the v1.34.x activities-InfiniteData incident).
const CACHE_BUSTER = Constants.expoConfig?.version ?? 'dev';

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});

// Sensitive queries that must never be persisted to disk
const EXCLUDED_QUERY_KEYS = ['travelDocuments'];

function serializeWithoutOptimisticEntries(client: PersistedClient): string {
  const cleaned: PersistedClient = {
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.map((q) => ({
        ...q,
        state: {
          ...q.state,
          // Handles both a plain array and InfiniteData<{items}, PageParam> —
          // the latter previously fell through this guard untouched, so
          // optimistic rows in any paginated query (chat, expenses, and soon
          // activities) were persisted to disk and rehydrated as phantoms on
          // cold start.
          data: stripOptimisticRows(q.state.data),
        },
      })),
    },
  };
  return JSON.stringify(cleaned);
}

// v2: the activities-tab query (['trips', tripId, 'activities']) changed
// shape from a flat Activity[] to a paginated InfiniteData<{items}> — an app
// already installed on a device has that key persisted in the OLD shape, and
// rehydrating it straight into useInfiniteQuery would crash (`.pages` on a
// plain array is undefined). Bumping the storage key forces one clean
// full-cache refetch on first launch after this update instead of rehydrating
// mismatched shapes. Every other persisted query pays the same one-time cost.
const persister = createSyncStoragePersister({
  storage: mmkvStorageAdapter,
  key: 'REACT_QUERY_CACHE_v2',
  serialize: serializeWithoutOptimisticEntries,
});

interface Props {
  children: ReactNode;
}

export function QueryProvider({ children }: Props) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // 30 days — a trip's data should survive a multi-week absence; stale
        // reads are clearly labelled (OfflineBanner + getQueryDisplayState).
        maxAge: 30 * 24 * 60 * 60 * 1000,
        buster: CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0];
            if (typeof key === 'string' && EXCLUDED_QUERY_KEYS.includes(key)) {
              return false;
            }
            return query.state.status === 'success';
          },
          // Offline mutations are persisted SEPARATELY now (utils/mutationQueue.ts)
          // so they aren't discarded with the query cache when maxAge lapses.
          shouldDehydrateMutation: () => false,
        },
      }}
      onSuccess={async () => {
        // Rehydrate the offline mutation queue from its own MMKV key (runs after
        // mutationDefaults registered — hydrated mutations get their fn there).
        hydrateMutationQueue(queryClient);
        subscribeMutationQueue(queryClient);

        // NetworkProvider.useEffect has NOT yet run at this point — child
        // effects fire before parent effects in React, so onlineManager may
        // still hold its default (online=true). getInitialOnlineStatus()
        // returns the same cached promise that NetworkProvider will consume,
        // so only one NetInfo.fetch() occurs across the two call sites.
        const online = await getInitialOnlineStatus().catch(() => true);
        onlineManager.setOnline(online);

        // Only resume and invalidate when online — when offline the hydrated
        // cache is the source of truth and triggering network work causes churn.
        if (onlineManager.isOnline()) {
          await queryClient.resumePausedMutations();
          queryClient.invalidateQueries();
        }
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
