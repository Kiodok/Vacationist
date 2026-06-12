import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTransferRentals } from '@vacationist/api';
import type {
  TransferRental,
  CreateTransferRentalVariables,
  UpdateTransferRentalVariables,
  DeleteTransferRentalVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useTransferRentals(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'transfer-rentals'],
    queryFn: () => getTransferRentals(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

// mutationFn + onSuccess (invalidation + toast) live in mutationDefaults so
// persisted mutations replay correctly after a cold start. Hooks keep
// onMutate (optimistic update) and onError (rollback + toast).

type RentalsContext = { previous: TransferRental[] | undefined };

function rentalsKey(tripId: string) {
  return ['trips', tripId, 'transfer-rentals'] as const;
}

export function useCreateTransferRental() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TransferRental, Error, CreateTransferRentalVariables, RentalsContext>({
    mutationKey: ['createTransferRental'],
    onMutate: async ({ tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: rentalsKey(tripId) });
      const previous = queryClient.getQueryData<TransferRental[]>(rentalsKey(tripId));

      const now = new Date().toISOString();
      const optimistic: TransferRental = {
        id: createOptimisticId(),
        trip_id: tripId,
        title: input.title,
        company: input.company ?? null,
        pickup_location: input.pickup_location ?? null,
        dropoff_location: input.dropoff_location ?? null,
        pickup_date: input.pickup_date ?? null,
        dropoff_date: input.dropoff_date ?? null,
        booking_reference: input.booking_reference ?? null,
        price_total: input.price_total ?? null,
        external_url: input.external_url ?? null,
        notes: input.notes ?? null,
        created_by: useAuthStore.getState().user?.id ?? '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      queryClient.setQueryData<TransferRental[]>(rentalsKey(tripId), (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(rentalsKey(tripId), context.previous);
      }
      addToast('error', i18n.t('transfer:toast.rentalAddFailed'));
    },
  });
}

export function useUpdateTransferRental() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TransferRental, Error, UpdateTransferRentalVariables, RentalsContext>({
    mutationKey: ['updateTransferRental'],
    onMutate: async ({ rentalId, tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: rentalsKey(tripId) });
      const previous = queryClient.getQueryData<TransferRental[]>(rentalsKey(tripId));
      queryClient.setQueryData<TransferRental[]>(
        rentalsKey(tripId),
        (old) => old?.map((r) => (r.id === rentalId ? { ...r, ...input } : r)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(rentalsKey(tripId), context.previous);
      }
      addToast('error', i18n.t('transfer:toast.rentalUpdateFailed'));
    },
  });
}

export function useDeleteTransferRental() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, DeleteTransferRentalVariables, RentalsContext>({
    mutationKey: ['deleteTransferRental'],
    onMutate: async ({ rentalId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: rentalsKey(tripId) });
      const previous = queryClient.getQueryData<TransferRental[]>(rentalsKey(tripId));
      queryClient.setQueryData<TransferRental[]>(
        rentalsKey(tripId),
        (old) => old?.filter((r) => r.id !== rentalId),
      );
      return { previous };
    },
    onError: (error, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(rentalsKey(tripId), context.previous);
      }
      addToast('error', error.message || i18n.t('transfer:toast.rentalRemoveFailed'));
    },
  });
}
