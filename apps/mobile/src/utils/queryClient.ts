import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
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
