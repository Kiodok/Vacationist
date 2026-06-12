import { describe, it, expect } from 'vitest';
import { getQueryDisplayState } from './useOfflineAwareQuery';

describe('getQueryDisplayState', () => {
  it('shows skeleton during a genuine initial load', () => {
    const state = getQueryDisplayState({ isPending: true, isLoading: true, fetchStatus: 'fetching' });
    expect(state).toEqual({ showSkeleton: true, showOfflineEmpty: false, refreshing: false });
  });

  it('shows offline empty state when there is no cached data and the fetch is paused', () => {
    const state = getQueryDisplayState({ isPending: true, isLoading: true, fetchStatus: 'paused' });
    expect(state).toEqual({ showSkeleton: false, showOfflineEmpty: true, refreshing: false });
  });

  it('reports refreshing only for an active refetch of existing data', () => {
    const state = getQueryDisplayState({ isPending: false, isLoading: false, fetchStatus: 'fetching' });
    expect(state).toEqual({ showSkeleton: false, showOfflineEmpty: false, refreshing: true });
  });

  it('never reports refreshing for a paused refetch (offline pull-to-refresh)', () => {
    const state = getQueryDisplayState({ isPending: false, isLoading: false, fetchStatus: 'paused' });
    expect(state).toEqual({ showSkeleton: false, showOfflineEmpty: false, refreshing: false });
  });

  it('is fully idle for a settled query', () => {
    const state = getQueryDisplayState({ isPending: false, isLoading: false, fetchStatus: 'idle' });
    expect(state).toEqual({ showSkeleton: false, showOfflineEmpty: false, refreshing: false });
  });
});
