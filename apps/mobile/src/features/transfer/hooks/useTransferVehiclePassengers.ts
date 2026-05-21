import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransferVehiclePassengers,
  addTransferVehiclePassenger,
  removeTransferVehiclePassenger,
  updateTransferVehiclePassenger,
} from '@vacationist/api';
import { useToastStore } from '../../../stores/toastStore';

export function useTransferVehiclePassengers(vehicleId: string) {
  return useQuery({
    queryKey: ['transfer-vehicles', vehicleId, 'passengers'],
    queryFn: () => getTransferVehiclePassengers(vehicleId),
    retry: 2,
    enabled: !!vehicleId,
  });
}

export function useAddTransferVehiclePassenger(tripId: string, vehicleId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ userId, isDriver }: { userId: string; isDriver?: boolean }) =>
      addTransferVehiclePassenger(vehicleId, userId, isDriver),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-vehicles', vehicleId, 'passengers'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
    },
    onError: () => {
      addToast('error', 'Failed to add passenger.');
    },
  });
}

export function useRemoveTransferVehiclePassenger(tripId: string, vehicleId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (userId: string) => removeTransferVehiclePassenger(vehicleId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-vehicles', vehicleId, 'passengers'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
    },
    onError: () => {
      addToast('error', 'Failed to remove passenger.');
    },
  });
}

export function useUpdateTransferVehiclePassenger(tripId: string, vehicleId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ userId, isDriver }: { userId: string; isDriver: boolean }) =>
      updateTransferVehiclePassenger(vehicleId, userId, isDriver),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-vehicles', vehicleId, 'passengers'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
    },
    onError: () => {
      addToast('error', 'Failed to update passenger.');
    },
  });
}
