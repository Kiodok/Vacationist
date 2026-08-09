import { useMemo } from 'react';
import type { Activity, TransferFlight } from '@vacationist/types';
import { dayjs } from '@vacationist/utils';
import { useTrip } from '../../trips/hooks/useTrips';
import { useTripMembers } from '../../trips/hooks/useMembers';
import { useAllActivities } from '../../activities/hooks/useActivities';
import { useAccommodations } from '../../accommodations/hooks/useAccommodations';
import { useTransferFlights } from '../../transfer/hooks/useTransferFlights';
import { useTransferVehicles } from '../../transfer/hooks/useTransferVehicles';
import { useTransferRentals } from '../../transfer/hooks/useTransferRentals';
import { useRecipes } from '../../recipes/hooks/useRecipes';
import { useAllTripShoppingItems } from '../../shopping/hooks/useShoppingItems';
import type { CandidateItem, HighlightCandidates } from '../utils/highlightSelection';

const AUTO_PICK_ACTIVITY_CAP = 5;

const ACTIVITY_STATUS_ORDER: Record<Activity['status'], number> = {
  reserved: 0,
  planned: 1,
  completed: 2,
  skipped: 3,
};

function compareActivities(a: Activity, b: Activity): number {
  const statusDiff = ACTIVITY_STATUS_ORDER[a.status] - ACTIVITY_STATUS_ORDER[b.status];
  if (statusDiff !== 0) return statusDiff;
  if (a.activity_date && b.activity_date) {
    if (a.activity_date < b.activity_date) return -1;
    if (a.activity_date > b.activity_date) return 1;
  }
  return 0;
}

function flightLabel(f: TransferFlight): string {
  if (f.departure_airport && f.arrival_airport) {
    const arrow = f.direction === 'outbound-return' ? '⇄' : '→';
    return `${f.departure_airport} ${arrow} ${f.arrival_airport}`;
  }
  return f.title;
}

export function useHighlightCandidates(tripId: string): {
  candidates: HighlightCandidates | null;
  isLoaded: boolean;
} {
  const tripQuery = useTrip(tripId);
  const membersQuery = useTripMembers(tripId);
  const activitiesQuery = useAllActivities(tripId);
  const accommodationsQuery = useAccommodations(tripId);
  const flightsQuery = useTransferFlights(tripId);
  const vehiclesQuery = useTransferVehicles(tripId);
  const rentalsQuery = useTransferRentals(tripId);
  const recipesQuery = useRecipes(tripId);
  const shoppingItemsQuery = useAllTripShoppingItems(tripId);

  const trip = tripQuery.data;
  const members = membersQuery.data ?? [];
  const activities = activitiesQuery.data ?? [];
  const accommodations = accommodationsQuery.data ?? [];
  const flights = flightsQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const rentals = rentalsQuery.data ?? [];
  const recipes = recipesQuery.data ?? [];
  const shoppingItems = shoppingItemsQuery.data ?? [];

  // Gate for selection hydration: a persisted selection must never be pruned
  // against pools that are merely still loading.
  const isLoaded =
    !!trip &&
    [
      tripQuery, membersQuery, activitiesQuery, accommodationsQuery,
      flightsQuery, vehiclesQuery, rentalsQuery, recipesQuery, shoppingItemsQuery,
    ].every((q) => !q.isPending);

  const candidates = useMemo((): HighlightCandidates | null => {
    if (!trip) return null;

    const durationDays = dayjs(trip.end_date).diff(dayjs(trip.start_date), 'day') + 1;
    const memberFirstNames = members.slice(0, 5).map((m) => m.user.name.split(' ')[0]);

    const sortedActivities = activities.filter((a) => !a.deleted_at).sort(compareActivities);
    const autoPickIds = new Set(
      sortedActivities
        .filter((a) => a.status === 'reserved' || a.status === 'planned')
        .slice(0, AUTO_PICK_ACTIVITY_CAP)
        .map((a) => a.id),
    );
    const activityItems: CandidateItem[] = sortedActivities.map((a) => ({
      id: a.id,
      label: a.title,
      isAutoPick: autoPickIds.has(a.id),
    }));

    const visibleAccommodations = accommodations.filter((a) => !a.deleted_at);
    const autoAccommodationId = visibleAccommodations.find(
      (a) => a.status === 'booked' || a.status === 'reserved',
    )?.id;
    const accommodationItems: CandidateItem[] = visibleAccommodations.map((a) => ({
      id: a.id,
      label: a.title,
      isAutoPick: a.id === autoAccommodationId,
    }));

    const toItem = (entry: { id: string; title: string }): CandidateItem => ({
      id: entry.id,
      label: entry.title,
      isAutoPick: false,
    });

    return {
      tripTitle: trip.title,
      startDate: trip.start_date,
      endDate: trip.end_date,
      durationDays,
      memberCount: members.length,
      memberFirstNames,
      shoppingItemCount: shoppingItems.filter((i) => !i.deleted_at).length,
      accommodations: accommodationItems,
      activities: activityItems,
      flights: flights.filter((f) => !f.deleted_at).map((f) => ({
        id: f.id,
        label: flightLabel(f),
        isAutoPick: false,
      })),
      vehicles: vehicles.filter((v) => !v.deleted_at).map(toItem),
      rentals: rentals.filter((r) => !r.deleted_at).map(toItem),
      recipes: recipes.map(toItem),
    };
  }, [trip, members, activities, accommodations, flights, vehicles, rentals, recipes, shoppingItems]);

  return { candidates, isLoaded };
}
