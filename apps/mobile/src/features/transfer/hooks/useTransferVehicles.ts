import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransferVehicles,
  createTransferVehicle,
  updateTransferVehicle,
  softDeleteTransferVehicle,
} from '@vacationist/api';
import type { CreateTransferVehicleInput, UpdateTransferVehicleInput } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useTransferVehicles(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'transfer-vehicles'],
    queryFn: () => getTransferVehicles(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useCreateTransferVehicle(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateTransferVehicleInput) => createTransferVehicle(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
      addToast('success', i18n.t('transfer:toast.vehicleAdded'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.vehicleAddFailed'));
    },
  });
}

export function useUpdateTransferVehicle(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ vehicleId, input }: { vehicleId: string; input: UpdateTransferVehicleInput }) =>
      updateTransferVehicle(vehicleId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
      addToast('success', i18n.t('transfer:toast.vehicleUpdated'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.vehicleUpdateFailed'));
    },
  });
}

export function useDeleteTransferVehicle(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (vehicleId: string) => softDeleteTransferVehicle(vehicleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
      addToast('success', i18n.t('transfer:toast.vehicleRemoved'));
    },
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('transfer:toast.vehicleRemoveFailed'));
    },
  });
}
