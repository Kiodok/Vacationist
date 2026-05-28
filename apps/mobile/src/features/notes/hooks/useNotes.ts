import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotes, createNote, updateNote, deleteNote } from '@vacationist/api';
import type { CreateTripNoteInput, UpdateTripNoteInput } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useNotes(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'notes'],
    queryFn: () => getNotes(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useCreateNote(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateTripNoteInput) => createNote(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notes'] });
      addToast('success', i18n.t('notes:toast.created'));
    },
    onError: () => {
      addToast('error', i18n.t('notes:toast.createFailed'));
    },
  });
}

export function useUpdateNote(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ noteId, input }: { noteId: string; input: UpdateTripNoteInput }) =>
      updateNote(noteId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notes'] });
      addToast('success', i18n.t('notes:toast.updated'));
    },
    onError: () => {
      addToast('error', i18n.t('notes:toast.updateFailed'));
    },
  });
}

export function useDeleteNote(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (noteId: string) => deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notes'] });
      addToast('success', i18n.t('notes:toast.deleted'));
    },
    onError: () => {
      addToast('error', i18n.t('notes:toast.deleteFailed'));
    },
  });
}
