import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getActivityVotes, castActivityVote, removeActivityVote } from '@vacationist/api';
import type { VoteType, ActivityVote } from '@vacationist/types';
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

export function useCastVote(tripId: string, activityId: string) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (vote: VoteType) => castActivityVote(activityId, vote),
    onMutate: async (vote) => {
      await queryClient.cancelQueries({ queryKey: ['activities', activityId, 'votes'] });
      const previous = queryClient.getQueryData<ActivityVote[]>(['activities', activityId, 'votes']);
      if (previous) {
        const exists = previous.findIndex((v) => v.user_id === currentUserId);
        const optimistic: ActivityVote[] =
          exists >= 0
            ? previous.map((v) => (v.user_id === currentUserId ? { ...v, vote } : v))
            : [...previous, { id: `optimistic-${Date.now()}`, activity_id: activityId, user_id: currentUserId!, vote, created_at: new Date().toISOString() }];
        queryClient.setQueryData(['activities', activityId, 'votes'], optimistic);
      }
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'votes'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
    },
    onError: (_error, _vote, context) => {
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
