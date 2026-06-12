import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotes } from '@vacationist/api';
import type {
  TripNote,
  CreateTripNoteVariables,
  UpdateTripNoteVariables,
  DeleteTripNoteVariables,
  ToggleTripNoteDoneVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useNotes(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'notes'],
    queryFn: () => getNotes(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

// mutationFn + onSuccess (invalidation + toast) live in mutationDefaults so
// persisted mutations replay correctly after a cold start. Hooks keep
// onMutate (optimistic update) and onError (rollback + toast).

export function useCreateNote() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TripNote, Error, CreateTripNoteVariables, { previous: TripNote[] | undefined }>({
    mutationKey: ['createTripNote'],
    onMutate: async ({ tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'notes'] });
      const previous = queryClient.getQueryData<TripNote[]>(['trips', tripId, 'notes']);

      const now = new Date().toISOString();
      const optimistic: TripNote = {
        id: createOptimisticId(),
        trip_id: tripId,
        created_by: useAuthStore.getState().user?.id ?? '',
        title: input.title,
        description: input.description ?? null,
        is_done: false,
        created_at: now,
        updated_at: now,
      };
      // Notes list is ordered created_at DESC — newest first.
      queryClient.setQueryData<TripNote[]>(
        ['trips', tripId, 'notes'],
        (old) => [optimistic, ...(old ?? [])],
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'notes'], context.previous);
      }
      addToast('error', i18n.t('notes:toast.createFailed'));
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TripNote, Error, UpdateTripNoteVariables, { previous: TripNote[] | undefined }>({
    mutationKey: ['updateTripNote'],
    onMutate: async ({ noteId, tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'notes'] });
      const previous = queryClient.getQueryData<TripNote[]>(['trips', tripId, 'notes']);
      queryClient.setQueryData<TripNote[]>(
        ['trips', tripId, 'notes'],
        (old) => old?.map((n) => (n.id === noteId ? { ...n, ...input } : n)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'notes'], context.previous);
      }
      addToast('error', i18n.t('notes:toast.updateFailed'));
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, DeleteTripNoteVariables, { previous: TripNote[] | undefined }>({
    mutationKey: ['deleteTripNote'],
    onMutate: async ({ noteId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'notes'] });
      const previous = queryClient.getQueryData<TripNote[]>(['trips', tripId, 'notes']);
      queryClient.setQueryData<TripNote[]>(
        ['trips', tripId, 'notes'],
        (old) => old?.filter((n) => n.id !== noteId),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'notes'], context.previous);
      }
      addToast('error', i18n.t('notes:toast.deleteFailed'));
    },
  });
}

export function useToggleNoteDone() {
  const queryClient = useQueryClient();

  return useMutation<TripNote, Error, ToggleTripNoteDoneVariables, { previous: TripNote[] | undefined }>({
    mutationKey: ['toggleTripNoteDone'],
    onMutate: async ({ noteId, tripId, isDone }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'notes'] });
      const previous = queryClient.getQueryData<TripNote[]>(['trips', tripId, 'notes']);
      queryClient.setQueryData<TripNote[]>(
        ['trips', tripId, 'notes'],
        (old) => old?.map((n) => (n.id === noteId ? { ...n, is_done: isDone } : n)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'notes'], context.previous);
      }
    },
  });
}
