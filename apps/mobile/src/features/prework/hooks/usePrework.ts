import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTopicPreferences,
  getMyTopicPreferences,
  upsertTopicPreferences,
  deleteTopicPreferences,
  resetTopicPreferences,
} from '@vacationist/api';
import type { UpsertPreworkPreferencesInput } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useTopicPreferences(topicId: string) {
  return useQuery({
    queryKey: ['prework-topics', topicId, 'preferences'],
    queryFn: () => getTopicPreferences(topicId),
    retry: 2,
    enabled: !!topicId,
  });
}

export function useMyTopicPreferences(topicId: string) {
  return useQuery({
    queryKey: ['prework-topics', topicId, 'my-preferences'],
    queryFn: () => getMyTopicPreferences(topicId),
    retry: 2,
    enabled: !!topicId,
  });
}

export function useUpsertTopicPreferences(topicId: string, tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: UpsertPreworkPreferencesInput) =>
      upsertTopicPreferences(topicId, tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prework-topics', topicId, 'preferences'] });
      queryClient.invalidateQueries({ queryKey: ['prework-topics', topicId, 'my-preferences'] });
      addToast('success', i18n.t('prework:toast.saved'));
    },
    onError: () => {
      addToast('error', i18n.t('prework:toast.saveFailed'));
    },
  });
}

export function useDeleteTopicPreferences(topicId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: () => deleteTopicPreferences(topicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prework-topics', topicId, 'preferences'] });
      queryClient.invalidateQueries({ queryKey: ['prework-topics', topicId, 'my-preferences'] });
      addToast('success', i18n.t('prework:toast.cleared'));
    },
    onError: () => {
      addToast('error', i18n.t('prework:toast.clearFailed'));
    },
  });
}

export function useResetTopicPreferences(topicId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: () => resetTopicPreferences(topicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prework-topics', topicId, 'preferences'] });
      queryClient.invalidateQueries({ queryKey: ['prework-topics', topicId, 'my-preferences'] });
      addToast('success', i18n.t('prework:toast.resetAll'));
    },
    onError: () => {
      addToast('error', i18n.t('prework:toast.resetAllFailed'));
    },
  });
}
