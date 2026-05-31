import { focusManager, onlineManager } from '@tanstack/react-query';
import { getInitialOnlineStatus } from '../hooks/netInfoUtils';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import type { ReactNode } from 'react';
import { mmkvStorageAdapter } from '../utils/mmkvStorage';
import { isOptimisticId } from '../utils/optimisticId';
import { queryClient, isPersistedMutationKey } from '../utils/queryClient';
import '../utils/mutationDefaults';

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
      queries: client.clientState.queries.map((q) => {
        if (Array.isArray(q.state.data)) {
          return {
            ...q,
            state: {
              ...q.state,
              data: q.state.data.filter(
                (item: unknown) =>
                  !(
                    item &&
                    typeof item === 'object' &&
                    'id' in item &&
                    typeof (item as { id: unknown }).id === 'string' &&
                    isOptimisticId((item as { id: string }).id)
                  ),
              ),
            },
          };
        }
        return q;
      }),
    },
  };
  return JSON.stringify(cleaned);
}

const persister = createSyncStoragePersister({
  storage: mmkvStorageAdapter,
  key: 'REACT_QUERY_CACHE',
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
        maxAge: 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0];
            if (typeof key === 'string' && EXCLUDED_QUERY_KEYS.includes(key)) {
              return false;
            }
            return query.state.status === 'success';
          },
          shouldDehydrateMutation: (mutation) => {
            return (
              mutation.state.isPaused &&
              isPersistedMutationKey(mutation.options.mutationKey?.[0])
            );
          },
        },
      }}
      onSuccess={async () => {
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
