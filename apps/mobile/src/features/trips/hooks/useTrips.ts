import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTrips, getTrip, createTrip, updateTrip, softDeleteTrip, TripNotFoundError } from '@vacationist/api';
import type { CreateTripInput, UpdateTripInput } from '@vacationist/types';
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
  return useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => getTrip(tripId),
    retry: (failureCount, error) => {
      if (error instanceof TripNotFoundError) return false;
      return failureCount < 2;
    },
    enabled: hasSession && !!tripId,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    onSuccess: (data) => {
      queryClient.setQueryData(['trips', data.id], { ...data, member_count: 1 });
      queryClient.invalidateQueries({ queryKey: ['trips'], exact: true });
      addToast('success', 'Trip created!');
    },
    onError: () => {
      addToast('error', 'Failed to create trip. Please try again.');
    },
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input: UpdateTripInput }) =>
      updateTrip(tripId, input),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      addToast('success', 'Trip updated');
    },
    onError: () => {
      addToast('error', 'Failed to update trip.');
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
      addToast('success', 'Trip deleted');
    },
    onError: () => {
      addToast('error', 'Failed to delete trip.');
    },
  });
}
