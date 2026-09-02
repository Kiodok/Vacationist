import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTransferPublicTransport } from '@vacationist/api';
import type {
  TransferPublicTransport,
  CreateTransferPublicTransportVariables,
  UpdateTransferPublicTransportVariables,
  DeleteTransferPublicTransportVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useTransferPublicTransport(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'transfer-public-transport'],
    queryFn: () => getTransferPublicTransport(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

// mutationFn + onSuccess (invalidation + toast) live in mutationDefaults so
// persisted mutations replay correctly after a cold start. Hooks keep
// onMutate (optimistic update) and onError (rollback + toast).

type PublicTransportContext = { previous: TransferPublicTransport[] | undefined };

function publicTransportKey(tripId: string) {
  return ['trips', tripId, 'transfer-public-transport'] as const;
}

export function useCreateTransferPublicTransport() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TransferPublicTransport, Error, CreateTransferPublicTransportVariables, PublicTransportContext>({
    mutationKey: ['createTransferPublicTransport'],
    onMutate: async ({ tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: publicTransportKey(tripId) });
      const previous = queryClient.getQueryData<TransferPublicTransport[]>(publicTransportKey(tripId));

      const now = new Date().toISOString();
      const optimistic: TransferPublicTransport = {
        id: createOptimisticId(),
        trip_id: tripId,
        title: input.title,
        company: input.company ?? null,
        departure_location: input.departure_location ?? null,
        arrival_location: input.arrival_location ?? null,
        departure_time: input.departure_time ?? null,
        arrival_time: input.arrival_time ?? null,
        booking_reference: input.booking_reference ?? null,
        price_total: input.price_total ?? null,
        external_url: input.external_url ?? null,
        notes: input.notes ?? null,
        created_by: useAuthStore.getState().user?.id ?? '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      queryClient.setQueryData<TransferPublicTransport[]>(publicTransportKey(tripId), (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(publicTransportKey(tripId), context.previous);
      }
      addToast('error', i18n.t('transfer:toast.publicTransportAddFailed'));
    },
  });
}

export function useUpdateTransferPublicTransport() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TransferPublicTransport, Error, UpdateTransferPublicTransportVariables, PublicTransportContext>({
    mutationKey: ['updateTransferPublicTransport'],
    onMutate: async ({ publicTransportId, tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: publicTransportKey(tripId) });
      const previous = queryClient.getQueryData<TransferPublicTransport[]>(publicTransportKey(tripId));
      queryClient.setQueryData<TransferPublicTransport[]>(
        publicTransportKey(tripId),
        (old) => old?.map((r) => (r.id === publicTransportId ? { ...r, ...input } : r)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(publicTransportKey(tripId), context.previous);
      }
      addToast('error', i18n.t('transfer:toast.publicTransportUpdateFailed'));
    },
  });
}

export function useDeleteTransferPublicTransport() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, DeleteTransferPublicTransportVariables, PublicTransportContext>({
    mutationKey: ['deleteTransferPublicTransport'],
    onMutate: async ({ publicTransportId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: publicTransportKey(tripId) });
      const previous = queryClient.getQueryData<TransferPublicTransport[]>(publicTransportKey(tripId));
      queryClient.setQueryData<TransferPublicTransport[]>(
        publicTransportKey(tripId),
        (old) => old?.filter((r) => r.id !== publicTransportId),
      );
      return { previous };
    },
    onError: (error, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(publicTransportKey(tripId), context.previous);
      }
      addToast('error', error.message || i18n.t('transfer:toast.publicTransportRemoveFailed'));
    },
  });
}
