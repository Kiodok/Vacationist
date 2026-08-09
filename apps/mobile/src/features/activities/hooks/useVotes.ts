import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getActivityVotes, getTripActivityVotes, getActivityVotesForTrips, castActivityVote, removeActivityVote } from '@vacationist/api';
import type { ActivityVote, CastActivityVoteVariables } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
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

/** Every vote for every activity in one trip. Key is stable per trip — unlike
 *  the old activity-id-list-keyed batch query, adding/paging activities never
 *  mints a new cache key or forces a refetch. */
export function useTripActivityVotes(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'activity-votes'],
    queryFn: () => getTripActivityVotes(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

/** Cross-trip variant for the global (all-trips) calendar. Keyed by trip id
 *  list, which is bounded by the user's trip membership count, not activity
 *  count. */
export function useActivityVotesForTrips(tripIds: string[]) {
  const sortedTripIds = [...tripIds].sort();
  return useQuery({
    queryKey: ['activity-votes', 'trips', ...sortedTripIds],
    queryFn: () => getActivityVotesForTrips(sortedTripIds),
    retry: 2,
    enabled: sortedTripIds.length > 0,
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
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activity-votes'] });
      queryClient.invalidateQueries({ queryKey: ['activity-votes', 'trips'] });
    },
    onError: (_error, { activityId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['activities', activityId, 'votes'], context.previous);
      }
      addToast('error', i18n.t('activities:toast.voteFailed'));
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
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activity-votes'] });
      queryClient.invalidateQueries({ queryKey: ['activity-votes', 'trips'] });
    },
    onError: () => {
      addToast('error', i18n.t('activities:toast.removeVoteFailed'));
    },
  });
}
