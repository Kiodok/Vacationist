import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransferVehicles,
  createTransferVehicle,
  updateTransferVehicle,
  softDeleteTransferVehicle,
} from '@vacationist/api';
import type { CreateTransferVehicleInput, UpdateTransferVehicleInput } from '@vacationist/types';
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
      addToast('success', 'Vehicle added');
    },
    onError: () => {
      addToast('error', 'Failed to add vehicle.');
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
      addToast('success', 'Vehicle updated');
    },
    onError: () => {
      addToast('error', 'Failed to update vehicle.');
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
      addToast('success', 'Vehicle removed');
    },
    onError: (error: Error) => {
      addToast('error', error.message || 'Failed to remove vehicle.');
    },
  });
}
