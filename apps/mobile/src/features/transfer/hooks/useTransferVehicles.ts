import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTransferVehicles } from '@vacationist/api';
import type {
  TransferVehicle,
  CreateTransferVehicleVariables,
  UpdateTransferVehicleVariables,
  DeleteTransferVehicleVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useTransferVehicles(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'transfer-vehicles'],
    queryFn: () => getTransferVehicles(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

// mutationFn + onSuccess (invalidation + toast) live in mutationDefaults so
// persisted mutations replay correctly after a cold start. Hooks keep
// onMutate (optimistic update) and onError (rollback + toast).

type VehiclesContext = { previous: TransferVehicle[] | undefined };

function vehiclesKey(tripId: string) {
  return ['trips', tripId, 'transfer-vehicles'] as const;
}

export function useCreateTransferVehicle() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TransferVehicle, Error, CreateTransferVehicleVariables, VehiclesContext>({
    mutationKey: ['createTransferVehicle'],
    onMutate: async ({ tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: vehiclesKey(tripId) });
      const previous = queryClient.getQueryData<TransferVehicle[]>(vehiclesKey(tripId));

      const now = new Date().toISOString();
      const optimistic: TransferVehicle = {
        id: createOptimisticId(),
        trip_id: tripId,
        title: input.title,
        direction: input.direction,
        notes: input.notes ?? null,
        created_by: useAuthStore.getState().user?.id ?? '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      queryClient.setQueryData<TransferVehicle[]>(vehiclesKey(tripId), (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(vehiclesKey(tripId), context.previous);
      }
      addToast('error', i18n.t('transfer:toast.vehicleAddFailed'));
    },
  });
}

export function useUpdateTransferVehicle() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TransferVehicle, Error, UpdateTransferVehicleVariables, VehiclesContext>({
    mutationKey: ['updateTransferVehicle'],
    onMutate: async ({ vehicleId, tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: vehiclesKey(tripId) });
      const previous = queryClient.getQueryData<TransferVehicle[]>(vehiclesKey(tripId));
      queryClient.setQueryData<TransferVehicle[]>(
        vehiclesKey(tripId),
        (old) => old?.map((v) => (v.id === vehicleId ? { ...v, ...input } : v)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(vehiclesKey(tripId), context.previous);
      }
      addToast('error', i18n.t('transfer:toast.vehicleUpdateFailed'));
    },
  });
}

export function useDeleteTransferVehicle() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, DeleteTransferVehicleVariables, VehiclesContext>({
    mutationKey: ['deleteTransferVehicle'],
    onMutate: async ({ vehicleId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: vehiclesKey(tripId) });
      const previous = queryClient.getQueryData<TransferVehicle[]>(vehiclesKey(tripId));
      queryClient.setQueryData<TransferVehicle[]>(
        vehiclesKey(tripId),
        (old) => old?.filter((v) => v.id !== vehicleId),
      );
      return { previous };
    },
    onError: (error, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(vehiclesKey(tripId), context.previous);
      }
      addToast('error', error.message || i18n.t('transfer:toast.vehicleRemoveFailed'));
    },
  });
}
