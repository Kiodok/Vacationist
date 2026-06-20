import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getActivities,
  getActivity,
  createActivity,
  updateActivity,
  softDeleteActivity,
  closeActivityVoting,
  reopenActivityVoting,
} from '@vacationist/api';
import type {
  Activity,
  ActivityVote,
  CreateActivityVariables,
  UpdateActivityVariables,
  DeleteActivityVariables,
  CloseActivityVotingVariables,
  ReopenActivityVotingVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useActivities(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'activities'],
    queryFn: () => getActivities(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useActivity(activityId: string) {
  return useQuery({
    queryKey: ['activities', activityId],
    queryFn: () => getActivity(activityId),
    retry: 2,
    enabled: !!activityId,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<Activity, Error, CreateActivityVariables, { previous: Activity[] | undefined }>({
    mutationKey: ['createActivity'],
    mutationFn: ({ tripId, input }) => createActivity(tripId, input),
    onMutate: async ({ tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'activities'] });
      const previous = queryClient.getQueryData<Activity[]>(['trips', tripId, 'activities']);

      const userId = useAuthStore.getState().user?.id ?? '';
      const optimistic: Activity = {
        id: createOptimisticId(),
        trip_id: tripId,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? null,
        cost_estimate: input.cost_estimate ?? null,
        activity_date: input.activity_date ?? null,
        start_time: input.start_time ?? null,
        end_time: input.end_time ?? null,
        external_url: input.external_url ?? null,
        maps_url: null,
        status: 'planned',
        voting_open: true,
        auto_close: input.auto_close ?? false,
        reservation_required: input.reservation_required ?? false,
        created_by: userId,
        created_at: new Date().toISOString(),
        deleted_at: null,
      };

      queryClient.setQueryData<Activity[]>(
        ['trips', tripId, 'activities'],
        (old) => [...(old ?? []), optimistic],
      );

      return { previous };
    },
    onError: (err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData<Activity[]>(['trips', tripId, 'activities'], context.previous);
      }
      if (__DEV__) console.error('[createActivity]', err);
      addToast('error', i18n.t('activities:toast.createFailed'));
    },
  });
}

// onSuccess (invalidation + toast) lives in mutationDefaults so it also fires
// for persisted mutations replayed after a cold start. Hooks keep onMutate
// (optimistic update) and onError (rollback + toast).

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<Activity, Error, UpdateActivityVariables, { previous: Activity[] | undefined }>({
    mutationKey: ['updateActivity'],
    mutationFn: ({ activityId, input }) => updateActivity(activityId, input),
    onMutate: async ({ activityId, tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'activities'] });
      const previous = queryClient.getQueryData<Activity[]>(['trips', tripId, 'activities']);
      queryClient.setQueryData<Activity[]>(
        ['trips', tripId, 'activities'],
        (old) => old?.map((a) => (a.id === activityId ? { ...a, ...input } : a)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'activities'], context.previous);
      }
      addToast('error', i18n.t('activities:toast.updateFailed'));
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, DeleteActivityVariables, { previous: Activity[] | undefined }>({
    mutationKey: ['deleteActivity'],
    mutationFn: ({ activityId }) => softDeleteActivity(activityId),
    onMutate: async ({ activityId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'activities'] });
      const previous = queryClient.getQueryData<Activity[]>(['trips', tripId, 'activities']);
      queryClient.setQueryData<Activity[]>(
        ['trips', tripId, 'activities'],
        (old) => old?.filter((a) => a.id !== activityId),
      );
      return { previous };
    },
    onError: (error, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'activities'], context.previous);
      }
      addToast('error', error.message || i18n.t('activities:toast.deleteFailed'));
    },
  });
}

function useSetVotingOpen(
  mutationKey: 'closeActivityVoting' | 'reopenActivityVoting',
  votingOpen: boolean,
) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  type Context = { previous: Activity[] | undefined; previousVotes: ActivityVote[] | undefined };

  return useMutation<void, Error, CloseActivityVotingVariables, Context>({
    mutationKey: [mutationKey],
    mutationFn: ({ activityId }) =>
      votingOpen ? reopenActivityVoting(activityId) : closeActivityVoting(activityId),
    onMutate: async ({ activityId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'activities'] });
      const previous = queryClient.getQueryData<Activity[]>(['trips', tripId, 'activities']);
      queryClient.setQueryData<Activity[]>(
        ['trips', tripId, 'activities'],
        (old) => old?.map((a) => (a.id === activityId ? { ...a, voting_open: votingOpen } : a)),
      );

      let previousVotes: ActivityVote[] | undefined;
      if (!votingOpen) {
        await queryClient.cancelQueries({ queryKey: ['activities', activityId, 'votes'] });
        previousVotes = queryClient.getQueryData<ActivityVote[]>(['activities', activityId, 'votes']);
        queryClient.setQueryData<ActivityVote[]>(
          ['activities', activityId, 'votes'],
          (old) => old?.filter((v) => v.vote !== 'group_blocker'),
        );
      }

      return { previous, previousVotes };
    },
    onError: (_err, { activityId, tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'activities'], context.previous);
        if (context.previousVotes !== undefined) {
          queryClient.setQueryData(['activities', activityId, 'votes'], context.previousVotes);
        }
      }
      addToast(
        'error',
        i18n.t(votingOpen ? 'activities:toast.reopenVotingFailed' : 'activities:toast.closeVotingFailed'),
      );
    },
  });
}

export function useCloseVoting() {
  return useSetVotingOpen('closeActivityVoting', false);
}

export function useReopenVoting() {
  return useSetVotingOpen('reopenActivityVoting', true);
}
