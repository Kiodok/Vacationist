import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTransferFlightPassengers, setTransferFlightPassengers } from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';
import { invalidateCostQueries } from '../../../utils/queryClient';

export function useTransferFlightPassengers(flightId: string) {
  return useQuery({
    queryKey: ['transfer-flights', flightId, 'passengers'],
    queryFn: () => getTransferFlightPassengers(flightId),
    retry: 2,
    enabled: !!flightId,
  });
}

export function useSetTransferFlightPassengers(tripId: string, flightId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (userIds: string[]) => setTransferFlightPassengers(flightId, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-flights', flightId, 'passengers'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
      // Pre-existing gap, fixed here (2026-10-03): unlike the PT equivalent, this never
      // invalidated the cost analysis — now that passengers can be assigned before booking and
      // the booking-prompt depends on this data being fresh, that staleness is no longer benign.
      invalidateCostQueries(tripId);
      addToast('success', i18n.t('transfer:toast.passengersUpdated'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.passengersFailed'));
    },
  });
}
