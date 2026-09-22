import { describe, it, expect, vi } from 'vitest';

// The module pulls in native-only packages and the whole API surface; only the pure selection rules
// are under test here.
vi.mock('expo-image', () => ({ Image: { prefetch: vi.fn() } }));
vi.mock('@react-native-community/netinfo', () => ({ default: { fetch: vi.fn() } }));
vi.mock('@vacationist/api', () => ({ getAccommodations: vi.fn(), getActivitiesForTrips: vi.fn(), getActivitiesPage: vi.fn(), getActivityVotesForTrips: vi.fn(), getAllActivities: vi.fn(), getAllExpenses: vi.fn(), getAllShoppingItemsForTrip: vi.fn(), getCurrencies: vi.fn(), getCurrentMemberRole: vi.fn(), getExpenses: vi.fn(), getLatestExchangeRates: vi.fn(), getLostFoundCases: vi.fn(), getMyTripCostShares: vi.fn(), getNotes: vi.fn(), getNotifications: vi.fn(), getPackingItems: vi.fn(), getSharedPackingItems: vi.fn(), getShoppingItems: vi.fn(), getShoppingLists: vi.fn(), getTransferFlights: vi.fn(), getTransferPublicTransport: vi.fn(), getTransferRentals: vi.fn(), getTransferVehicles: vi.fn(), getTrip: vi.fn(), getTripActivityVotes: vi.fn(), getTripBalances: vi.fn(), getTripCostSummary: vi.fn(), getTripMembers: vi.fn(), getTripMessages: vi.fn(), getTripTabContent: vi.fn(), getTrips: vi.fn() }));

import { isAutoPrefetchTrip, isTripPrefetchFresh, PREFETCH_FRESH_MS } from './offlinePrefetch';

const trip = (status: string, start: string, end: string) => ({ status, start_date: start, end_date: end }) as never;

describe('isAutoPrefetchTrip', () => {
  const today = '2026-09-21';
  it('downloads planning and ongoing trips', () => {
    expect(isAutoPrefetchTrip(trip('planning', '2026-10-01', '2026-10-10'), today)).toBe(true);
    expect(isAutoPrefetchTrip(trip('planning', '2026-09-20', '2026-09-25'), today)).toBe(true);
    expect(isAutoPrefetchTrip(trip('planning', '2026-09-21', '2026-09-21'), today)).toBe(true); // last day counts
  });
  it('leaves completed/archived trips (and ones already past their end date) to the on-open cache', () => {
    expect(isAutoPrefetchTrip(trip('completed', '2026-01-01', '2026-01-10'), today)).toBe(false);
    expect(isAutoPrefetchTrip(trip('archived', '2026-10-01', '2026-10-10'), today)).toBe(false);
    expect(isAutoPrefetchTrip(trip('planning', '2026-08-01', '2026-08-10'), today)).toBe(false);
  });
});

describe('isTripPrefetchFresh', () => {
  it('is false for a trip that was never downloaded', () => {
    expect(isTripPrefetchFresh('never-seen')).toBe(false);
  });
  it('exposes a sane freshness window', () => {
    expect(PREFETCH_FRESH_MS).toBe(5 * 60 * 1000);
  });
});
