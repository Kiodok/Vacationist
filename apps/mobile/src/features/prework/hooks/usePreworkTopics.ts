import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPreworkTopics,
  createPreworkTopic,
  updatePreworkTopic,
  deletePreworkTopic,
} from '@vacationist/api';
import type { CreatePreworkTopicInput, UpdatePreworkTopicInput, PreworkTopic } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function usePreworkTopics(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'prework-topics'],
    queryFn: () => getPreworkTopics(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useCreatePreworkTopic(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreatePreworkTopicInput) => createPreworkTopic(tripId, input),
    onSuccess: (newTopic) => {
      // Optimistic update so setActiveTopicId(newTopic.id) in the screen's onSuccess
      // finds the topic in the cache before the background refetch completes.
      queryClient.setQueryData<PreworkTopic[]>(
        ['trips', tripId, 'prework-topics'],
        (old) => (old ? [...old, newTopic] : [newTopic]),
      );
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'prework-topics'] });
      addToast('success', i18n.t('prework:topic.toast.created'));
    },
    onError: () => {
      addToast('error', i18n.t('prework:topic.toast.createFailed'));
    },
  });
}

export function useUpdatePreworkTopic(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ topicId, input }: { topicId: string; input: UpdatePreworkTopicInput }) =>
      updatePreworkTopic(topicId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'prework-topics'] });
      addToast('success', i18n.t('prework:topic.toast.updated'));
    },
    onError: () => {
      addToast('error', i18n.t('prework:topic.toast.updateFailed'));
    },
  });
}

export function useDeletePreworkTopic(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (topicId: string) => deletePreworkTopic(topicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'prework-topics'] });
      addToast('success', i18n.t('prework:topic.toast.deleted'));
    },
    onError: () => {
      addToast('error', i18n.t('prework:topic.toast.deleteFailed'));
    },
  });
}
