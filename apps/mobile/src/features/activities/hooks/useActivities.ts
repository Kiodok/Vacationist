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
import type { CreateActivityInput, UpdateActivityInput } from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';

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

export function useCreateActivity(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateActivityInput) => createActivity(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
      addToast('success', 'Activity created');
    },
    onError: () => {
      addToast('error', 'Failed to create activity.');
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
      queryClient.invalidateQueries({ queryKey: ['activities', activityId] });
      addToast('success', 'Activity updated');
    },
    onError: () => {
      addToast('error', 'Failed to update activity.');
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
      addToast('success', 'Activity deleted');
    },
    onError: (error: Error) => {
      addToast('error', error.message || 'Failed to delete activity.');
    },
  });
}

export function useCloseVoting(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (activityId: string) => closeActivityVoting(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
      addToast('success', 'Voting closed');
    },
    onError: () => {
      addToast('error', 'Failed to close voting.');
    },
  });
}

export function useReopenVoting(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (activityId: string) => reopenActivityVoting(activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
      addToast('success', 'Voting re-opened');
    },
    onError: () => {
      addToast('error', 'Failed to re-open voting.');
    },
  });
}
