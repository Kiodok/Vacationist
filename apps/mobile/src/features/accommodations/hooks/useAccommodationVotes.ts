import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccommodationVotes, castAccommodationVote } from '@vacationist/api';
import type { AccommodationVote, CastAccommodationVoteVariables, RemoveAccommodationVoteVariables } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useAccommodationVotes(accommodationId: string) {
  return useQuery({
    queryKey: ['accommodations', accommodationId, 'votes'],
    queryFn: () => getAccommodationVotes(accommodationId),
    retry: 2,
    enabled: !!accommodationId,
  });
}

export function useCastAccommodationVote() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<AccommodationVote, Error, CastAccommodationVoteVariables, { previous: AccommodationVote[] | undefined }>({
    mutationKey: ['castAccommodationVote'],
    mutationFn: ({ vote, accommodationId }) => castAccommodationVote(accommodationId, vote),
    onMutate: async ({ vote, accommodationId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
      const previous = queryClient.getQueryData<AccommodationVote[]>(['accommodations', accommodationId, 'votes']);
      if (previous) {
        const exists = previous.findIndex((v) => v.user_id === currentUserId);
        const optimistic: AccommodationVote[] =
          exists >= 0
            ? previous.map((v) => (v.user_id === currentUserId ? { ...v, vote } : v))
            : [...previous, { id: createOptimisticId(), accommodation_id: accommodationId, trip_id: tripId, user_id: currentUserId!, vote, created_at: new Date().toISOString() }];
        queryClient.setQueryData(['accommodations', accommodationId, 'votes'], optimistic);
      }
      return { previous };
    },
    onSuccess: (_data, { accommodationId, tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    },
    onError: (_error, { accommodationId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['accommodations', accommodationId, 'votes'], context.previous);
      }
      addToast('error', i18n.t('accommodations:toast.voteFailed'));
    },
  });
}

// Persisted (mutationFn + onSuccess in mutationDefaults). Call
// `.mutate({ accommodationId, tripId })`.
export function useRemoveAccommodationVote() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, RemoveAccommodationVoteVariables, { previous: AccommodationVote[] | undefined }>({
    mutationKey: ['removeAccommodationVote'],
    onMutate: async ({ accommodationId }) => {
      await queryClient.cancelQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
      const previous = queryClient.getQueryData<AccommodationVote[]>(['accommodations', accommodationId, 'votes']);
      queryClient.setQueryData<AccommodationVote[]>(
        ['accommodations', accommodationId, 'votes'],
        (old) => old?.filter((v) => v.user_id !== currentUserId),
      );
      return { previous };
    },
    onError: (_err, { accommodationId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['accommodations', accommodationId, 'votes'], context.previous);
      }
      addToast('error', i18n.t('accommodations:toast.removeVoteFailed'));
    },
  });
}
