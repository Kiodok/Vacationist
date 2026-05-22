import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccommodationVotes, castAccommodationVote, removeAccommodationVote } from '@vacationist/api';
import type { VoteType, AccommodationVote } from '@vacationist/types';
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

export function useCastAccommodationVote(tripId: string, accommodationId: string) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (vote: VoteType) => castAccommodationVote(accommodationId, vote),
    onMutate: async (vote) => {
      await queryClient.cancelQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
      const previous = queryClient.getQueryData<AccommodationVote[]>(['accommodations', accommodationId, 'votes']);
      if (previous) {
        const exists = previous.findIndex((v) => v.user_id === currentUserId);
        const optimistic: AccommodationVote[] =
          exists >= 0
            ? previous.map((v) => (v.user_id === currentUserId ? { ...v, vote } : v))
            : [...previous, { id: `optimistic-${Date.now()}`, accommodation_id: accommodationId, trip_id: tripId, user_id: currentUserId!, vote, created_at: new Date().toISOString() }];
        queryClient.setQueryData(['accommodations', accommodationId, 'votes'], optimistic);
      }
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    },
    onError: (_error, _vote, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['accommodations', accommodationId, 'votes'], context.previous);
      }
      addToast('error', 'Failed to cast vote.');
    },
  });
}

export function useRemoveAccommodationVote(tripId: string, accommodationId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: () => removeAccommodationVote(accommodationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accommodations', accommodationId, 'votes'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    },
    onError: () => {
      addToast('error', 'Failed to remove vote.');
    },
  });
}
