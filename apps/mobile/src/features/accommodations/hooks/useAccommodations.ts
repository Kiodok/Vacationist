import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAccommodations,
  getAccommodation,
  createAccommodation,
  updateAccommodation,
  softDeleteAccommodation,
  closeAccommodationVoting,
  reopenAccommodationVoting,
} from '@vacationist/api';
import type { CreateAccommodationInput, UpdateAccommodationInput } from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';

export function useAccommodations(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'accommodations'],
    queryFn: () => getAccommodations(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useAccommodation(accommodationId: string) {
  return useQuery({
    queryKey: ['accommodations', accommodationId],
    queryFn: () => getAccommodation(accommodationId),
    retry: 2,
    enabled: !!accommodationId,
  });
}

export function useCreateAccommodation(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateAccommodationInput) => createAccommodation(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
      addToast('success', 'Accommodation added');
    },
    onError: () => {
      addToast('error', 'Failed to add accommodation.');
    },
  });
}

export function useUpdateAccommodation(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ accommodationId, input }: { accommodationId: string; input: UpdateAccommodationInput }) =>
      updateAccommodation(accommodationId, input),
    onSuccess: (_data, { accommodationId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
      queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId] });
      addToast('success', 'Accommodation updated');
    },
    onError: () => {
      addToast('error', 'Failed to update accommodation.');
    },
  });
}

export function useDeleteAccommodation(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (accommodationId: string) => softDeleteAccommodation(accommodationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
      addToast('success', 'Accommodation removed');
    },
    onError: (error: Error) => {
      addToast('error', error.message || 'Failed to remove accommodation.');
    },
  });
}

export function useCloseAccommodationVoting(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (accommodationId: string) => closeAccommodationVoting(accommodationId),
    onSuccess: (_data, accommodationId) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
      queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
      addToast('success', 'Voting closed');
    },
    onError: () => {
      addToast('error', 'Failed to close voting.');
    },
  });
}

export function useReopenAccommodationVoting(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (accommodationId: string) => reopenAccommodationVoting(accommodationId),
    onSuccess: (_data, accommodationId) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
      queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
      addToast('success', 'Voting re-opened');
    },
    onError: () => {
      addToast('error', 'Failed to re-open voting.');
    },
  });
}
