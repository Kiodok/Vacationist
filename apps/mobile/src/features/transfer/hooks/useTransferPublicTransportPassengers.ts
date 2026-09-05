import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPublicTransportPassengers,
  addPublicTransportPassenger,
  removePublicTransportPassenger,
} from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';
import { invalidateCostQueries } from '../../../utils/queryClient';

// Public transport passengers (v1.34.1 task 4). Vehicle-style model: the RLS policy on
// transfer_public_transport_passengers allows self (join/leave), the PT entry's creator, and
// trip organizers — so a plain add/remove is enough, no join_/leave_ RPC pair.
//
// Deliberately NOT persisted (same as the vehicle passenger mutations): a set-diff replay after
// a stale reconnect could silently re-add/remove the wrong people. The generic
// "could not be saved" toast from the mutation-cache subscriber covers a real offline failure.

function passengerKey(publicTransportId: string) {
  return ['transfer-public-transport', publicTransportId, 'passengers'] as const;
}

export function useTransferPublicTransportPassengers(publicTransportId: string) {
  return useQuery({
    queryKey: passengerKey(publicTransportId),
    queryFn: () => getPublicTransportPassengers(publicTransportId),
    retry: 2,
    enabled: !!publicTransportId,
  });
}

export function useAddPublicTransportPassenger(tripId: string, publicTransportId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (userId: string) => addPublicTransportPassenger(publicTransportId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: passengerKey(publicTransportId) });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-public-transport'] });
      invalidateCostQueries(tripId);
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.addPassengerFailed'));
    },
  });
}

export function useRemovePublicTransportPassenger(tripId: string, publicTransportId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (userId: string) => removePublicTransportPassenger(publicTransportId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: passengerKey(publicTransportId) });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-public-transport'] });
      invalidateCostQueries(tripId);
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.removePassengerFailed'));
    },
  });
}
