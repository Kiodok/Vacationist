import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransferRentals,
  createTransferRental,
  updateTransferRental,
  softDeleteTransferRental,
} from '@vacationist/api';
import type { CreateTransferRentalInput, UpdateTransferRentalInput } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useTransferRentals(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'transfer-rentals'],
    queryFn: () => getTransferRentals(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useCreateTransferRental(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateTransferRentalInput) => createTransferRental(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-rentals'] });
      addToast('success', i18n.t('transfer:toast.rentalAdded'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.rentalAddFailed'));
    },
  });
}

export function useUpdateTransferRental(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ rentalId, input }: { rentalId: string; input: UpdateTransferRentalInput }) =>
      updateTransferRental(rentalId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-rentals'] });
      addToast('success', i18n.t('transfer:toast.rentalUpdated'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.rentalUpdateFailed'));
    },
  });
}

export function useDeleteTransferRental(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (rentalId: string) => softDeleteTransferRental(rentalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-rentals'] });
      addToast('success', i18n.t('transfer:toast.rentalRemoved'));
    },
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('transfer:toast.rentalRemoveFailed'));
    },
  });
}
