import type { FetchStatus } from '@tanstack/react-query';

export interface QueryDisplayState {
  /** Initial load actively running — show the skeleton. */
  showSkeleton: boolean;
  /** No cached data AND the fetch is paused (offline) — show OfflineEmptyState. */
  showOfflineEmpty: boolean;
  /**
   * The fetch genuinely failed (not offline-paused) and there is no cached data to fall back on —
   * show QueryErrorState, never a screen's normal "nothing here yet" empty state. Before this
   * field existed, a query that errored on its very first load (no prior cache — a real 500, or a
   * request that came back with an untrustworthy result and correctly threw, see
   * `looksSessionValid`) matched neither `showSkeleton` nor `showOfflineEmpty`, so every screen
   * fell through to ITS OWN empty-state render — a real failure looked identical to genuine
   * emptiness (v1.39.0 round 3; this is what made Prework show a false "no topics yet"). A query
   * that already has data keeps that data across an error transition (TanStack never clears it),
   * so `showError` deliberately does NOT fire in that case — the screen just keeps showing the
   * stale-but-real data, exactly as it already did.
   */
  showError: boolean;
  /** Refetch of existing data actively running — drive RefreshControl. */
  refreshing: boolean;
}

interface QueryLike {
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
  fetchStatus: FetchStatus;
  data: unknown;
}

// fetchStatus (not isFetching) is the load-bearing signal here: a query whose
// fetch was paused by offlineFirst networkMode keeps isFetching === true
// forever, which is what caused infinite skeletons and stuck pull-to-refresh
// spinners while offline.
export function getQueryDisplayState(q: QueryLike): QueryDisplayState {
  return {
    showSkeleton: q.isPending && q.fetchStatus === 'fetching',
    showOfflineEmpty: q.isPending && q.fetchStatus === 'paused',
    showError: q.isError && q.data === undefined,
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
