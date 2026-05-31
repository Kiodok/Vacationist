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
import type { Activity, CreateActivityInput, UpdateActivityInput, CreateActivityVariables } from '@vacationist/types';
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
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
      addToast('success', i18n.t('activities:toast.created'));
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

export function useUpdateActivity(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ activityId, input }: { activityId: string; input: UpdateActivityInput }) =>
      updateActivity(activityId, input),
    onSuccess: (_data, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
      queryClient.invalidateQueries({ queryKey: ['global-calendar-activities'] });
      queryClient.invalidateQueries({ queryKey: ['activities', activityId] });
      addToast('success', i18n.t('activities:toast.updated'));
    },
    onError: () => {
      addToast('error', i18n.t('activities:toast.updateFailed'));
    },
  });
}

export function useDeleteActivity(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (activityId: string) => softDeleteActivity(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
      addToast('success', i18n.t('activities:toast.deleted'));
    },
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('activities:toast.deleteFailed'));
    },
  });
}

export function useCloseVoting(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (activityId: string) => closeActivityVoting(activityId),
    onSuccess: (_data, activityId) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'votes'] });
      addToast('success', i18n.t('activities:toast.votingClosed'));
    },
    onError: () => {
      addToast('error', i18n.t('activities:toast.closeVotingFailed'));
    },
  });
}

export function useReopenVoting(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (activityId: string) => reopenActivityVoting(activityId),
    onSuccess: (_data, activityId) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'votes'] });
      addToast('success', i18n.t('activities:toast.votingReopened'));
    },
    onError: () => {
      addToast('error', i18n.t('activities:toast.reopenVotingFailed'));
    },
  });
}
