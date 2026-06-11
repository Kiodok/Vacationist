import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NoteContentInput } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../stores/toastStore';

// Factory for the entity-scoped note hooks (activity + accommodation notes).
// Query/mutation behavior is identical across note features; only the cache key
// segment, the toast namespace, and the API functions differ.
interface NoteHooksConfig<TNote> {
  parentKey: 'activities' | 'accommodations';
  namespace: 'activityNotes' | 'accommodationNotes';
  api: {
    get: (parentId: string) => Promise<TNote[]>;
    create: (parentId: string, input: NoteContentInput) => Promise<TNote>;
    update: (noteId: string, input: NoteContentInput) => Promise<TNote>;
    remove: (noteId: string) => Promise<void>;
  };
}

export function createNoteHooks<TNote>({ parentKey, namespace, api }: NoteHooksConfig<TNote>) {
  const notesKey = (parentId: string) => [parentKey, parentId, 'notes'] as const;

  function useNotes(parentId: string) {
    return useQuery({
      queryKey: notesKey(parentId),
      queryFn: () => api.get(parentId),
      retry: 2,
      enabled: !!parentId,
    });
  }

  function useCreateNote(parentId: string) {
    const queryClient = useQueryClient();
    const addToast = useToastStore((s) => s.addToast);

    return useMutation({
      mutationFn: (input: NoteContentInput) => api.create(parentId, input),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: notesKey(parentId) });
        addToast('success', i18n.t(`${namespace}:toast.created`));
      },
      onError: () => {
        addToast('error', i18n.t(`${namespace}:toast.createFailed`));
      },
    });
  }

  function useUpdateNote(parentId: string) {
    const queryClient = useQueryClient();
    const addToast = useToastStore((s) => s.addToast);

    return useMutation({
      mutationFn: ({ noteId, input }: { noteId: string; input: NoteContentInput }) =>
        api.update(noteId, input),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: notesKey(parentId) });
        addToast('success', i18n.t(`${namespace}:toast.updated`));
      },
      onError: () => {
        addToast('error', i18n.t(`${namespace}:toast.updateFailed`));
      },
    });
  }

  function useDeleteNote(parentId: string) {
    const queryClient = useQueryClient();
    const addToast = useToastStore((s) => s.addToast);

    return useMutation({
      mutationFn: (noteId: string) => api.remove(noteId),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: notesKey(parentId) });
        addToast('success', i18n.t(`${namespace}:toast.deleted`));
      },
      onError: () => {
        addToast('error', i18n.t(`${namespace}:toast.deleteFailed`));
      },
    });
  }

  return { useNotes, useCreateNote, useUpdateNote, useDeleteNote };
}
