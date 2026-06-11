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
import { i18n } from '@vacationist/i18n';
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
      addToast('success', i18n.t('accommodations:toast.added'));
    },
    onError: () => {
      addToast('error', i18n.t('accommodations:toast.addFailed'));
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
      addToast('success', i18n.t('accommodations:toast.updated'));
    },
    onError: () => {
      addToast('error', i18n.t('accommodations:toast.updateFailed'));
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
      addToast('success', i18n.t('accommodations:toast.removed'));
    },
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('accommodations:toast.removeFailed'));
    },
  });
}

export function useBookAccommodation(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ accommodationId, checkIn, checkOut }: { accommodationId: string; checkIn: string; checkOut: string }) =>
      updateAccommodation(accommodationId, { status: 'booked', check_in_date: checkIn, check_out_date: checkOut }),
    onSuccess: (_data, { accommodationId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
      queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId] });
      addToast('success', i18n.t('accommodations:toast.booked'));
    },
    onError: () => {
      addToast('error', i18n.t('accommodations:toast.bookFailed'));
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
      addToast('success', i18n.t('accommodations:toast.votingClosed'));
    },
    onError: () => {
      addToast('error', i18n.t('accommodations:toast.closeVotingFailed'));
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
      addToast('success', i18n.t('accommodations:toast.votingReopened'));
    },
    onError: () => {
      addToast('error', i18n.t('accommodations:toast.reopenVotingFailed'));
    },
  });
}
