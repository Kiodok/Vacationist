import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getActivityNotes, createActivityNote, updateActivityNote, deleteActivityNote } from '@vacationist/api';
import type { ActivityNote, CreateActivityNoteInput, UpdateActivityNoteInput } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useActivityNotes(activityId: string) {
  return useQuery({
    queryKey: ['activities', activityId, 'notes'],
    queryFn: () => getActivityNotes(activityId),
    retry: 2,
    enabled: !!activityId,
  });
}

export function useCreateActivityNote(activityId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateActivityNoteInput) => createActivityNote(activityId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'notes'] });
      addToast('success', i18n.t('activityNotes:toast.created'));
    },
    onError: () => {
      addToast('error', i18n.t('activityNotes:toast.createFailed'));
    },
  });
}

export function useUpdateActivityNote(activityId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ noteId, input }: { noteId: string; input: UpdateActivityNoteInput }) =>
      updateActivityNote(noteId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'notes'] });
      addToast('success', i18n.t('activityNotes:toast.updated'));
    },
    onError: () => {
      addToast('error', i18n.t('activityNotes:toast.updateFailed'));
    },
  });
}

export function useDeleteActivityNote(activityId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (noteId: string) => deleteActivityNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'notes'] });
      addToast('success', i18n.t('activityNotes:toast.deleted'));
    },
    onError: () => {
      addToast('error', i18n.t('activityNotes:toast.deleteFailed'));
    },
  });
}
