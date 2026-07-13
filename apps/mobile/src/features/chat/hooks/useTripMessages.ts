import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTripMessages } from '@vacationist/api';
import type {
  TripMessageWithSender,
  CreateTripMessageVariables,
  UpdateTripMessageVariables,
  DeleteTripMessageVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';
import {
  prependMessage,
  replaceMessage,
  removeMessage,
  type MessagesData,
} from '../utils/messageCache';

export function useTripMessages(tripId: string) {
  return useInfiniteQuery({
    queryKey: ['trips', tripId, 'messages'],
    queryFn: ({ pageParam }) => getTripMessages(tripId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: 2,
    enabled: !!tripId,
  });
}

// mutationFn + onSuccess (surgical cache patch, no invalidation — invalidating
// an infinite query refetches every loaded page) live in mutationDefaults so
// persisted mutations replay correctly after a cold start. Hooks keep
// onMutate (optimistic update) and onError (rollback + toast).

export function useCreateMessage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TripMessageWithSender, Error, CreateTripMessageVariables, { previous: MessagesData | undefined }>({
    mutationKey: ['createTripMessage'],
    onMutate: async ({ tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'messages'] });
      const previous = queryClient.getQueryData<MessagesData>(['trips', tripId, 'messages']);

      const user = useAuthStore.getState().user;
      const now = new Date().toISOString();
      const optimistic: TripMessageWithSender = {
        id: createOptimisticId(),
        trip_id: tripId,
        created_by: user?.id ?? '',
        text: input.text.trim(),
        created_at: now,
        updated_at: now,
        deleted_at: null,
        sender: user ? { name: user.name, avatar_url: user.avatar_url } : null,
      };
      queryClient.setQueryData<MessagesData>(
        ['trips', tripId, 'messages'],
        (old) => prependMessage(old, optimistic),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'messages'], context.previous);
      }
      addToast('error', i18n.t('chat:toast.sendFailed'));
    },
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<TripMessageWithSender, Error, UpdateTripMessageVariables, { previous: MessagesData | undefined }>({
    mutationKey: ['updateTripMessage'],
    onMutate: async ({ messageId, tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'messages'] });
      const previous = queryClient.getQueryData<MessagesData>(['trips', tripId, 'messages']);
      queryClient.setQueryData<MessagesData>(
        ['trips', tripId, 'messages'],
        (old) =>
          old &&
          replaceMessage(old, {
            id: messageId,
            text: input.text.trim(),
            updated_at: new Date().toISOString(),
          }),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'messages'], context.previous);
      }
      addToast('error', i18n.t('chat:toast.updateFailed'));
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, DeleteTripMessageVariables, { previous: MessagesData | undefined }>({
    mutationKey: ['deleteTripMessage'],
    onMutate: async ({ messageId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'messages'] });
      const previous = queryClient.getQueryData<MessagesData>(['trips', tripId, 'messages']);
      queryClient.setQueryData<MessagesData>(
        ['trips', tripId, 'messages'],
        (old) => old && removeMessage(old, messageId),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'messages'], context.previous);
      }
      addToast('error', i18n.t('chat:toast.deleteFailed'));
    },
  });
}
