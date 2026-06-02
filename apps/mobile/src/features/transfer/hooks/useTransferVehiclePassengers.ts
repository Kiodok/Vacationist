import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransferVehiclePassengers,
  addTransferVehiclePassenger,
  removeTransferVehiclePassenger,
  updateTransferVehiclePassenger,
  joinVehicle,
  leaveVehicle,
} from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
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
      addToast('error', i18n.t('transfer:toast.addPassengerFailed'));
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
      addToast('error', i18n.t('transfer:toast.removePassengerFailed'));
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
      addToast('error', i18n.t('transfer:toast.passengersFailed'));
    },
  });
}

export function useJoinVehicle(tripId: string, vehicleId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: () => joinVehicle(vehicleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-vehicles', vehicleId, 'passengers'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.joinVehicleFailed'));
    },
  });
}

export function useLeaveVehicle(tripId: string, vehicleId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: () => leaveVehicle(vehicleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-vehicles', vehicleId, 'passengers'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.leaveVehicleFailed'));
    },
  });
}
