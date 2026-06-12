import type { FetchStatus } from '@tanstack/react-query';

export interface QueryDisplayState {
  /** Initial load actively running — show the skeleton. */
  showSkeleton: boolean;
  /** No cached data AND the fetch is paused (offline) — show OfflineEmptyState. */
  showOfflineEmpty: boolean;
  /** Refetch of existing data actively running — drive RefreshControl. */
  refreshing: boolean;
}

interface QueryLike {
  isPending: boolean;
  isLoading: boolean;
  fetchStatus: FetchStatus;
}

// fetchStatus (not isFetching) is the load-bearing signal here: a query whose
// fetch was paused by offlineFirst networkMode keeps isFetching === true
// forever, which is what caused infinite skeletons and stuck pull-to-refresh
// spinners while offline.
export function getQueryDisplayState(q: QueryLike): QueryDisplayState {
  return {
    showSkeleton: q.isPending && q.fetchStatus === 'fetching',
    showOfflineEmpty: q.isPending && q.fetchStatus === 'paused',
    refreshing: q.fetchStatus === 'fetching' && !q.isLoading,
  };
}

export function useOfflineAwareRefresh(q: QueryLike & { refetch: () => unknown }): {
  refreshing: boolean;
  onRefresh: () => void;
} {
  return {
    refreshing: getQueryDisplayState(q).refreshing,
    onRefresh: () => q.refetch(),
  };
}
