import { QueryClient, focusManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import type { ReactNode } from 'react';
import { mmkvStorageAdapter } from '../utils/mmkvStorage';

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 0,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 3,
      networkMode: 'offlineFirst',
    },
  },
});

const persister = createSyncStoragePersister({
  storage: mmkvStorageAdapter,
  key: 'REACT_QUERY_CACHE',
});

// Sensitive queries that must never be persisted to disk
const EXCLUDED_QUERY_KEYS = ['travelDocuments'];

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
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
