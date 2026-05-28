import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransferFlights,
  getTransferFlight,
  createTransferFlight,
  updateTransferFlight,
  softDeleteTransferFlight,
  closeTransferFlightVoting,
  reopenTransferFlightVoting,
  bookTransferFlight,
} from '@vacationist/api';
import type { CreateTransferFlightInput, UpdateTransferFlightInput, BookTransferFlightInput } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useTransferFlights(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'transfer-flights'],
    queryFn: () => getTransferFlights(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useTransferFlight(flightId: string) {
  return useQuery({
    queryKey: ['transfer-flights', flightId],
    queryFn: () => getTransferFlight(flightId),
    retry: 2,
    enabled: !!flightId,
  });
}

export function useCreateTransferFlight(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateTransferFlightInput) => createTransferFlight(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
      addToast('success', i18n.t('transfer:toast.flightAdded'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.flightAddFailed'));
    },
  });
}

export function useUpdateTransferFlight(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ flightId, input }: { flightId: string; input: UpdateTransferFlightInput }) =>
      updateTransferFlight(flightId, input),
    onSuccess: (_data, { flightId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-flights', flightId] });
      addToast('success', i18n.t('transfer:toast.flightUpdated'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.flightUpdateFailed'));
    },
  });
}

export function useDeleteTransferFlight(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (flightId: string) => softDeleteTransferFlight(flightId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
      addToast('success', i18n.t('transfer:toast.flightRemoved'));
    },
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('transfer:toast.flightRemoveFailed'));
    },
  });
}

export function useCloseTransferFlightVoting(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (flightId: string) => closeTransferFlightVoting(flightId),
    onSuccess: (_data, flightId) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-flights', flightId, 'votes'] });
      addToast('success', i18n.t('transfer:toast.votingClosed'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.closeVotingFailed'));
    },
  });
}

export function useReopenTransferFlightVoting(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (flightId: string) => reopenTransferFlightVoting(flightId),
    onSuccess: (_data, flightId) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-flights', flightId, 'votes'] });
      addToast('success', i18n.t('transfer:toast.votingReopened'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.reopenVotingFailed'));
    },
  });
}

export function useBookTransferFlight(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ flightId, input }: { flightId: string; input: BookTransferFlightInput }) =>
      bookTransferFlight(flightId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
      addToast('success', i18n.t('transfer:toast.flightBooked'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.flightBookFailed'));
    },
  });
}
