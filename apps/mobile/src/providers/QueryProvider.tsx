import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import type { ReactNode } from 'react';

// Wire React Native's AppState into TanStack Query's focus manager so that
// refetchOnWindowFocus actually triggers on Android/iOS when the app comes
// back to the foreground (browser focus events don't fire on native).
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
      // staleTime: 0 means data is always considered stale. Combined with
      // refetchOnMount: 'stale' (the TanStack default), every component mount
      // triggers a background refetch — the user sees cached data instantly
      // while fresh server data loads silently behind it. This is essential
      // for a collaborative app where another device may have changed the data.
      staleTime: 0,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

interface Props {
  children: ReactNode;
}

export function QueryProvider({ children }: Props) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
