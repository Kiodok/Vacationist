import { focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import type { ReactNode } from 'react';
import { mmkvStorageAdapter } from '../utils/mmkvStorage';
import { isOptimisticId } from '../utils/optimisticId';
import { queryClient } from '../utils/queryClient';
import '../utils/mutationDefaults';

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});

// Sensitive queries that must never be persisted to disk
const EXCLUDED_QUERY_KEYS = ['travelDocuments'];

// Mutation keys for which defaults are registered and offline persistence is enabled
const PERSISTED_MUTATION_KEYS = [
  'createActivity',
  'castActivityVote',
  'castAccommodationVote',
  'castTransferFlightVote',
];

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
              PERSISTED_MUTATION_KEYS.some(
                (key) => mutation.options.mutationKey?.[0] === key,
              )
            );
          },
        },
      }}
      onSuccess={async () => {
        await queryClient.resumePausedMutations();
        queryClient.invalidateQueries();
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
