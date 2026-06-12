import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccommodations, getAccommodation } from '@vacationist/api';
import type {
  Accommodation,
  CreateAccommodationVariables,
  UpdateAccommodationVariables,
  DeleteAccommodationVariables,
  BookAccommodationVariables,
  CloseAccommodationVotingVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useAccommodations(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'accommodations'],
    queryFn: () => getAccommodations(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useAccommodation(accommodationId: string) {
  return useQuery({
    queryKey: ['accommodations', accommodationId],
    queryFn: () => getAccommodation(accommodationId),
    retry: 2,
    enabled: !!accommodationId,
  });
}

// mutationFn + onSuccess (invalidation + toast) live in mutationDefaults so
// persisted mutations replay correctly after a cold start. Hooks keep
// onMutate (optimistic update) and onError (rollback + toast).

type ListContext = { previous: Accommodation[] | undefined };

function listKey(tripId: string) {
  return ['trips', tripId, 'accommodations'] as const;
}

export function useCreateAccommodation() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<Accommodation, Error, CreateAccommodationVariables, ListContext>({
    mutationKey: ['createAccommodation'],
    onMutate: async ({ tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: listKey(tripId) });
      const previous = queryClient.getQueryData<Accommodation[]>(listKey(tripId));

      const optimistic: Accommodation = {
        id: createOptimisticId(),
        trip_id: tripId,
        title: input.title,
        description: input.description ?? null,
        price_total: input.price_total ?? null,
        external_url: input.external_url ?? null,
        notes: input.notes ?? null,
        status: 'suggested',
        voting_open: true,
        auto_close: input.auto_close ?? false,
        check_in_date: input.check_in_date ?? null,
        check_out_date: input.check_out_date ?? null,
        created_by: useAuthStore.getState().user?.id ?? '',
        created_at: new Date().toISOString(),
        deleted_at: null,
      };
      queryClient.setQueryData<Accommodation[]>(listKey(tripId), (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(listKey(tripId), context.previous);
      }
      addToast('error', i18n.t('accommodations:toast.addFailed'));
    },
  });
}

export function useUpdateAccommodation() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<Accommodation, Error, UpdateAccommodationVariables, ListContext>({
    mutationKey: ['updateAccommodation'],
    onMutate: async ({ accommodationId, tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: listKey(tripId) });
      const previous = queryClient.getQueryData<Accommodation[]>(listKey(tripId));
      queryClient.setQueryData<Accommodation[]>(
        listKey(tripId),
        (old) => old?.map((a) => (a.id === accommodationId ? { ...a, ...input } : a)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(listKey(tripId), context.previous);
      }
      addToast('error', i18n.t('accommodations:toast.updateFailed'));
    },
  });
}

export function useDeleteAccommodation() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, DeleteAccommodationVariables, ListContext>({
    mutationKey: ['deleteAccommodation'],
    onMutate: async ({ accommodationId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: listKey(tripId) });
      const previous = queryClient.getQueryData<Accommodation[]>(listKey(tripId));
      queryClient.setQueryData<Accommodation[]>(
        listKey(tripId),
        (old) => old?.filter((a) => a.id !== accommodationId),
      );
      return { previous };
    },
    onError: (error, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(listKey(tripId), context.previous);
      }
      addToast('error', error.message || i18n.t('accommodations:toast.removeFailed'));
    },
  });
}

function useSetAccommodationStatus(
  mutationKey: 'bookAccommodation' | 'unbookAccommodation',
  status: Accommodation['status'],
) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<Accommodation, Error, BookAccommodationVariables, ListContext>({
    mutationKey: [mutationKey],
    onMutate: async ({ accommodationId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: listKey(tripId) });
      const previous = queryClient.getQueryData<Accommodation[]>(listKey(tripId));
      queryClient.setQueryData<Accommodation[]>(
        listKey(tripId),
        (old) => old?.map((a) => (a.id === accommodationId ? { ...a, status } : a)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(listKey(tripId), context.previous);
      }
      addToast(
        'error',
        i18n.t(status === 'booked' ? 'accommodations:toast.bookFailed' : 'accommodations:toast.unbookFailed'),
      );
    },
  });
}

export function useBookAccommodation() {
  return useSetAccommodationStatus('bookAccommodation', 'booked');
}

export function useUnbookAccommodation() {
  return useSetAccommodationStatus('unbookAccommodation', 'suggested');
}

function useSetAccommodationVotingOpen(
  mutationKey: 'closeAccommodationVoting' | 'reopenAccommodationVoting',
  votingOpen: boolean,
) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, CloseAccommodationVotingVariables, ListContext>({
    mutationKey: [mutationKey],
    onMutate: async ({ accommodationId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: listKey(tripId) });
      const previous = queryClient.getQueryData<Accommodation[]>(listKey(tripId));
      queryClient.setQueryData<Accommodation[]>(
        listKey(tripId),
        (old) => old?.map((a) => (a.id === accommodationId ? { ...a, voting_open: votingOpen } : a)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(listKey(tripId), context.previous);
      }
      addToast(
        'error',
        i18n.t(votingOpen ? 'accommodations:toast.reopenVotingFailed' : 'accommodations:toast.closeVotingFailed'),
      );
    },
  });
}

export function useCloseAccommodationVoting() {
  return useSetAccommodationVotingOpen('closeAccommodationVoting', false);
}

export function useReopenAccommodationVoting() {
  return useSetAccommodationVotingOpen('reopenAccommodationVoting', true);
}
