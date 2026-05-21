import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransferRentals,
  createTransferRental,
  updateTransferRental,
  softDeleteTransferRental,
} from '@vacationist/api';
import type { CreateTransferRentalInput, UpdateTransferRentalInput } from '@vacationist/types';
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
      addToast('success', 'Rental car added');
    },
    onError: () => {
      addToast('error', 'Failed to add rental car.');
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
      addToast('success', 'Rental car updated');
    },
    onError: () => {
      addToast('error', 'Failed to update rental car.');
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
      addToast('success', 'Rental car removed');
    },
    onError: (error: Error) => {
      addToast('error', error.message || 'Failed to remove rental car.');
    },
  });
}
