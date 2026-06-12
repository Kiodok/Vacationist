import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTransferFlights, getTransferFlight } from '@vacationist/api';
import type {
  TransferFlight,
  CreateTransferFlightVariables,
  UpdateTransferFlightVariables,
  DeleteTransferFlightVariables,
  CloseTransferFlightVotingVariables,
  ReopenTransferFlightVotingVariables,
  BookTransferFlightVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useTransferFlights(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'transfer-flights'],
    queryFn: () => getTransferFlights(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useTransferFlight(flightId: string) {
  return useQuery({
    queryKey: ['transfer-flights', flightId],
    queryFn: () => getTransferFlight(flightId),
    retry: 2,
    enabled: !!flightId,
  });
}

// mutationFn + onSuccess (invalidation + toast) live in mutationDefaults so
// persisted mutations replay correctly after a cold start. Hooks keep
// onMutate (optimistic update) and onError (rollback + toast).

type FlightsContext = { previous: TransferFlight[] | undefined };

function flightsKey(tripId: string) {
  return ['trips', tripId, 'transfer-flights'] as const;
}

export function useCreateTransferFlight() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TransferFlight, Error, CreateTransferFlightVariables, FlightsContext>({
    mutationKey: ['createTransferFlight'],
    onMutate: async ({ tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: flightsKey(tripId) });
      const previous = queryClient.getQueryData<TransferFlight[]>(flightsKey(tripId));

      const now = new Date().toISOString();
      const optimistic: TransferFlight = {
        id: createOptimisticId(),
        trip_id: tripId,
        title: input.title,
        description: input.description ?? null,
        direction: input.direction,
        airline: input.airline ?? null,
        departure_airport: input.departure_airport ?? null,
        arrival_airport: input.arrival_airport ?? null,
        departure_time: input.departure_time ?? null,
        arrival_time: input.arrival_time ?? null,
        return_departure_airport: input.return_departure_airport ?? null,
        return_arrival_airport: input.return_arrival_airport ?? null,
        return_departure_time: input.return_departure_time ?? null,
        return_arrival_time: input.return_arrival_time ?? null,
        price_per_person: input.price_per_person ?? null,
        external_url: input.external_url ?? null,
        flight_number: null,
        booking_reference: null,
        notes: input.notes ?? null,
        status: 'suggested',
        voting_open: true,
        auto_close: input.auto_close ?? false,
        created_by: useAuthStore.getState().user?.id ?? '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      queryClient.setQueryData<TransferFlight[]>(flightsKey(tripId), (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(flightsKey(tripId), context.previous);
      }
      addToast('error', i18n.t('transfer:toast.flightAddFailed'));
    },
  });
}

export function useUpdateTransferFlight() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TransferFlight, Error, UpdateTransferFlightVariables, FlightsContext>({
    mutationKey: ['updateTransferFlight'],
    onMutate: async ({ flightId, tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: flightsKey(tripId) });
      const previous = queryClient.getQueryData<TransferFlight[]>(flightsKey(tripId));
      queryClient.setQueryData<TransferFlight[]>(
        flightsKey(tripId),
        (old) => old?.map((f) => (f.id === flightId ? { ...f, ...input } : f)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(flightsKey(tripId), context.previous);
      }
      addToast('error', i18n.t('transfer:toast.flightUpdateFailed'));
    },
  });
}

export function useDeleteTransferFlight() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, DeleteTransferFlightVariables, FlightsContext>({
    mutationKey: ['deleteTransferFlight'],
    onMutate: async ({ flightId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: flightsKey(tripId) });
      const previous = queryClient.getQueryData<TransferFlight[]>(flightsKey(tripId));
      queryClient.setQueryData<TransferFlight[]>(
        flightsKey(tripId),
        (old) => old?.filter((f) => f.id !== flightId),
      );
      return { previous };
    },
    onError: (error, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(flightsKey(tripId), context.previous);
      }
      addToast('error', error.message || i18n.t('transfer:toast.flightRemoveFailed'));
    },
  });
}

function useSetFlightVotingOpen(
  mutationKey: 'closeTransferFlightVoting' | 'reopenTransferFlightVoting',
  votingOpen: boolean,
) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, CloseTransferFlightVotingVariables, FlightsContext>({
    mutationKey: [mutationKey],
    onMutate: async ({ flightId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: flightsKey(tripId) });
      const previous = queryClient.getQueryData<TransferFlight[]>(flightsKey(tripId));
      queryClient.setQueryData<TransferFlight[]>(
        flightsKey(tripId),
        (old) => old?.map((f) => (f.id === flightId ? { ...f, voting_open: votingOpen } : f)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(flightsKey(tripId), context.previous);
      }
      addToast(
        'error',
        i18n.t(votingOpen ? 'transfer:toast.reopenVotingFailed' : 'transfer:toast.closeVotingFailed'),
      );
    },
  });
}

export function useCloseTransferFlightVoting() {
  return useSetFlightVotingOpen('closeTransferFlightVoting', false);
}

export function useReopenTransferFlightVoting() {
  return useSetFlightVotingOpen('reopenTransferFlightVoting', true);
}

export function useBookTransferFlight() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, BookTransferFlightVariables, FlightsContext>({
    mutationKey: ['bookTransferFlight'],
    onMutate: async ({ flightId, tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: flightsKey(tripId) });
      const previous = queryClient.getQueryData<TransferFlight[]>(flightsKey(tripId));
      queryClient.setQueryData<TransferFlight[]>(
        flightsKey(tripId),
        (old) => old?.map((f) =>
          f.id === flightId
            ? {
                ...f,
                status: 'booked',
                voting_open: false,
                flight_number: input.flight_number ?? f.flight_number,
                booking_reference: input.booking_reference ?? f.booking_reference,
              }
            : f,
        ),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(flightsKey(tripId), context.previous);
      }
      addToast('error', i18n.t('transfer:toast.flightBookFailed'));
    },
  });
}
