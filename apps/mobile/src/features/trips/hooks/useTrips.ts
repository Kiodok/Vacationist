import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTrips, getTrip, createTrip, updateTrip, softDeleteTrip } from '@vacationist/api';
import type { CreateTripInput, UpdateTripInput } from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: getTrips,
    retry: 2,
  });
}

export function useTrip(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => getTrip(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
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
