import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTransferFlightPassengers, setTransferFlightPassengers } from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

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
      addToast('success', i18n.t('transfer:toast.passengersUpdated'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.passengersFailed'));
    },
  });
}
