import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getTrips, getTrip, createTrip, softDeleteTrip, TripNotFoundError } from '@vacationist/api';
import type { CreateTripInput, Trip, UpdateTripVariables } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useTrips() {
  const hasSession = useAuthStore((s) => s.hasSession);
  return useQuery({
    queryKey: ['trips'],
    queryFn: getTrips,
    enabled: hasSession,
    retry: 2,
  });
}

export function useTrip(tripId: string) {
  const hasSession = useAuthStore((s) => s.hasSession);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => getTrip(tripId),
    retry: (failureCount, error) => {
      if (error instanceof TripNotFoundError) return false;
      return failureCount < 2;
    },
    enabled: hasSession && !!tripId,
  });

  // TripNotFoundError means RLS has revoked access (user removed from trip).
  // Purge all cached data for this trip subtree so the user sees a proper error
  // screen instead of stale activities / expenses / members.
  // purgedForTrip tracks which tripId has already been purged to prevent the
  // loop: removeQueries resets state → triggers refetch → same error → repeat.
  const purgedForTrip = useRef<string | null>(null);
  useEffect(() => {
    if (query.error instanceof TripNotFoundError && purgedForTrip.current !== tripId) {
      purgedForTrip.current = tripId;
      // Cancel any in-flight fetch first so it can't re-insert a stale error
      // entry after the cache is purged.
      void qc.cancelQueries({ queryKey: ['trips', tripId] }).then(() => {
        qc.removeQueries({ queryKey: ['trips', tripId] });
      });
    }
  }, [query.error, tripId, qc]);

  return query;
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    onSuccess: (data) => {
      queryClient.setQueryData(['trips', data.id], { ...data, member_count: 1 });
      queryClient.invalidateQueries({ queryKey: ['trips'], exact: true });
      addToast('success', i18n.t('trips:toast.created'));
    },
    onError: () => {
      addToast('error', i18n.t('trips:toast.createFailed'));
    },
  });
}

// mutationFn + onSuccess (invalidation + toast) live in mutationDefaults so
// the persisted mutation replays correctly after a cold start.
export function useUpdateTrip() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<Trip, Error, UpdateTripVariables, { previous: Trip | undefined }>({
    mutationKey: ['updateTrip'],
    onMutate: async ({ tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId], exact: true });
      const previous = queryClient.getQueryData<Trip>(['trips', tripId]);
      queryClient.setQueryData<Trip>(
        ['trips', tripId],
        (old) => (old ? { ...old, ...input } : old),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId], context.previous);
      }
      addToast('error', i18n.t('trips:toast.updateFailed'));
    },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (tripId: string) => softDeleteTrip(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      addToast('success', i18n.t('trips:toast.deleted'));
    },
    onError: () => {
      addToast('error', i18n.t('trips:toast.deleteFailed'));
    },
  });
}
