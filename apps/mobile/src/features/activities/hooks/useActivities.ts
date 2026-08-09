import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getActivitiesPage,
  ACTIVITY_PAGE_SIZE,
  getAllActivities,
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
import { activitiesPageKey, allActivitiesKey } from '../utils/activityKeys';
import {
  applyActivityCacheOp,
  snapshotActivityCaches,
  restoreActivityCaches,
  type ActivityCacheSnapshot,
} from '../utils/activityCache';

/** Paged feed for the activities tab. Not for whole-trip consumers — see useAllActivities. */
export function useActivities(tripId: string) {
  return useInfiniteQuery({
    queryKey: activitiesPageKey(tripId),
    // The `as number` cast matches the established pattern in useExpenses.ts —
    // TanStack's inferred TPageParam widens to `unknown` in this codebase's
    // version pairing even with a typed initialPageParam.
    queryFn: ({ pageParam }) => getActivitiesPage(tripId, (pageParam as number) ?? 0),
    initialPageParam: 0,
    // Offset from page COUNT, not summed item lengths — an optimistic
    // insert/remove mutates a page's items[] and would otherwise corrupt the
    // next offset.
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * ACTIVITY_PAGE_SIZE : undefined,
    retry: 2,
    enabled: !!tripId,
  });
}

/**
 * Every non-deleted activity for a trip, unpaginated. For consumers that are
 * semantically whole-trip — calendar grouping, markdown export, highlight
 * selection, full-list search — never the paged activities-tab feed
 * (`useActivities`), so they never silently see only the first page.
 */
export function useAllActivities(tripId: string, enabled = true) {
  return useQuery({
    queryKey: allActivitiesKey(tripId),
    queryFn: () => getAllActivities(tripId),
    retry: 2,
    enabled: !!tripId && enabled,
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

  return useMutation<Activity, Error, CreateActivityVariables, { snapshot: ActivityCacheSnapshot }>({
    mutationKey: ['createActivity'],
    mutationFn: ({ tripId, input }) => createActivity(tripId, input),
    onMutate: async ({ tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: activitiesPageKey(tripId) });
      const snapshot = snapshotActivityCaches(queryClient, tripId);

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

      applyActivityCacheOp(queryClient, tripId, { kind: 'insert', activity: optimistic });

      return { snapshot };
    },
    onError: (err, { tripId }, context) => {
      if (context !== undefined) {
        restoreActivityCaches(queryClient, tripId, context.snapshot);
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

  return useMutation<Activity, Error, UpdateActivityVariables, { snapshot: ActivityCacheSnapshot }>({
    mutationKey: ['updateActivity'],
    mutationFn: ({ activityId, input }) => updateActivity(activityId, input),
    onMutate: async ({ activityId, tripId, input }) => {
      await queryClient.cancelQueries({ queryKey: activitiesPageKey(tripId) });
      const snapshot = snapshotActivityCaches(queryClient, tripId);
      applyActivityCacheOp(queryClient, tripId, { kind: 'patch', id: activityId, patch: input });
      return { snapshot };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        restoreActivityCaches(queryClient, tripId, context.snapshot);
      }
      addToast('error', i18n.t('activities:toast.updateFailed'));
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, DeleteActivityVariables, { snapshot: ActivityCacheSnapshot }>({
    mutationKey: ['deleteActivity'],
    mutationFn: ({ activityId }) => softDeleteActivity(activityId),
    onMutate: async ({ activityId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: activitiesPageKey(tripId) });
      const snapshot = snapshotActivityCaches(queryClient, tripId);
      applyActivityCacheOp(queryClient, tripId, { kind: 'remove', id: activityId });
      return { snapshot };
    },
    onError: (error, { tripId }, context) => {
      if (context !== undefined) {
        restoreActivityCaches(queryClient, tripId, context.snapshot);
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

  type Context = { snapshot: ActivityCacheSnapshot; previousVotes: ActivityVote[] | undefined };

  return useMutation<void, Error, CloseActivityVotingVariables, Context>({
    mutationKey: [mutationKey],
    mutationFn: ({ activityId }) =>
      votingOpen ? reopenActivityVoting(activityId) : closeActivityVoting(activityId),
    onMutate: async ({ activityId, tripId }) => {
      await queryClient.cancelQueries({ queryKey: activitiesPageKey(tripId) });
      const snapshot = snapshotActivityCaches(queryClient, tripId);
      applyActivityCacheOp(queryClient, tripId, {
        kind: 'patch',
        id: activityId,
        patch: { voting_open: votingOpen },
      });

      let previousVotes: ActivityVote[] | undefined;
      if (!votingOpen) {
        await queryClient.cancelQueries({ queryKey: ['activities', activityId, 'votes'] });
        previousVotes = queryClient.getQueryData<ActivityVote[]>(['activities', activityId, 'votes']);
        queryClient.setQueryData<ActivityVote[]>(
          ['activities', activityId, 'votes'],
          (old) => old?.filter((v) => v.vote !== 'group_blocker'),
        );
      }

      return { snapshot, previousVotes };
    },
    onError: (_err, { activityId, tripId }, context) => {
      if (context !== undefined) {
        restoreActivityCaches(queryClient, tripId, context.snapshot);
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
