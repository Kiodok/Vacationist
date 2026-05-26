import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getActivityVotes, getActivityVotesBatch, castActivityVote, removeActivityVote } from '@vacationist/api';
import type { ActivityVote, CastActivityVoteVariables } from '@vacationist/types';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useActivityVotes(activityId: string) {
  return useQuery({
    queryKey: ['activities', activityId, 'votes'],
    queryFn: () => getActivityVotes(activityId),
    retry: 2,
    enabled: !!activityId,
  });
}

export function useActivityVotesBatch(activityIds: string[]) {
  const sortedIds = [...activityIds].sort();
  return useQuery({
    queryKey: ['activity-votes-batch', ...sortedIds],
    queryFn: () => getActivityVotesBatch(sortedIds),
    retry: 2,
    enabled: sortedIds.length > 0,
  });
}

export function useCastVote() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<ActivityVote, Error, CastActivityVoteVariables, { previous: ActivityVote[] | undefined }>({
    mutationKey: ['castActivityVote'],
    mutationFn: ({ vote, activityId }) => castActivityVote(activityId, vote),
    onMutate: async ({ vote, activityId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: ['activities', activityId, 'votes'] });
      const previous = queryClient.getQueryData<ActivityVote[]>(['activities', activityId, 'votes']);
      if (previous) {
        const exists = previous.findIndex((v) => v.user_id === currentUserId);
        const optimistic: ActivityVote[] =
          exists >= 0
            ? previous.map((v) => (v.user_id === currentUserId ? { ...v, vote } : v))
            : [...previous, { id: createOptimisticId(), activity_id: activityId, trip_id: tripId, user_id: currentUserId!, vote, created_at: new Date().toISOString() }];
        queryClient.setQueryData(['activities', activityId, 'votes'], optimistic);
      }
      return { previous };
    },
    onSuccess: (_data, { activityId, tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'votes'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
    },
    onError: (_error, { activityId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['activities', activityId, 'votes'], context.previous);
      }
      addToast('error', 'Failed to cast vote.');
    },
  });
}

export function useRemoveVote(tripId: string, activityId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: () => removeActivityVote(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'votes'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
    },
    onError: () => {
      addToast('error', 'Failed to remove vote.');
    },
  });
}
