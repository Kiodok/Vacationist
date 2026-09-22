import { describe, it, expect } from 'vitest';
import { getQueryDisplayState } from './useOfflineAwareQuery';

// `isError`/`data` default to the "settled, no data" shape unless a test overrides them.
const base = { isError: false, data: undefined as unknown };

describe('getQueryDisplayState', () => {
  it('shows skeleton during a genuine initial load', () => {
    const state = getQueryDisplayState({ ...base, isPending: true, isLoading: true, fetchStatus: 'fetching' });
    expect(state).toEqual({ showSkeleton: true, showOfflineEmpty: false, showError: false, refreshing: false });
  });

  it('shows offline empty state when there is no cached data and the fetch is paused', () => {
    const state = getQueryDisplayState({ ...base, isPending: true, isLoading: true, fetchStatus: 'paused' });
    expect(state).toEqual({ showSkeleton: false, showOfflineEmpty: true, showError: false, refreshing: false });
  });

  it('reports refreshing only for an active refetch of existing data', () => {
    const state = getQueryDisplayState({ ...base, isPending: false, isLoading: false, fetchStatus: 'fetching' });
    expect(state).toEqual({ showSkeleton: false, showOfflineEmpty: false, showError: false, refreshing: true });
  });

  it('never reports refreshing for a paused refetch (offline pull-to-refresh)', () => {
    const state = getQueryDisplayState({ ...base, isPending: false, isLoading: false, fetchStatus: 'paused' });
    expect(state).toEqual({ showSkeleton: false, showOfflineEmpty: false, showError: false, refreshing: false });
  });

  it('is fully idle for a settled query', () => {
    const state = getQueryDisplayState({ ...base, isPending: false, isLoading: false, fetchStatus: 'idle' });
    expect(state).toEqual({ showSkeleton: false, showOfflineEmpty: false, showError: false, refreshing: false });
  });

  // v1.39.0 round 3: a genuine failure with no cached data must render as a real error, never as a
  // false "nothing here" empty state (the actual bug behind Prework's false "no topics yet").
  it('shows a real error state when a query with no prior data genuinely fails', () => {
    const state = getQueryDisplayState({ isPending: false, isLoading: false, fetchStatus: 'idle', isError: true, data: undefined });
    expect(state).toEqual({ showSkeleton: false, showOfflineEmpty: false, showError: true, refreshing: false });
  });

  it('does NOT show the error state when stale-but-real data is still available', () => {
    const state = getQueryDisplayState({ isPending: false, isLoading: false, fetchStatus: 'idle', isError: true, data: [{ id: '1' }] });
    expect(state).toEqual({ showSkeleton: false, showOfflineEmpty: false, showError: false, refreshing: false });
  });

  // A paused-offline query's TanStack `status` is 'pending' by definition, so `isError` is always
  // false while `fetchStatus === 'paused'` in real usage — showOfflineEmpty (not showError) is the
  // only branch that can fire for it.
  it('a paused (offline) fetch reports offline-empty, not error', () => {
    const state = getQueryDisplayState({ ...base, isPending: true, isLoading: true, fetchStatus: 'paused' });
    expect(state).toEqual({ showSkeleton: false, showOfflineEmpty: true, showError: false, refreshing: false });
  });
});
