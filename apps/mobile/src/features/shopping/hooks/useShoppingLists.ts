import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShoppingLists,
  createShoppingList,
  updateShoppingList,
  archiveShoppingList,
  unarchiveShoppingList,
  deleteShoppingList,
} from '@vacationist/api';
import type { CreateShoppingListInput, UpdateShoppingListInput } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useShoppingLists(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'shopping-lists'],
    queryFn: () => getShoppingLists(tripId),
    retry: 2,
    enabled: !!tripId,
    refetchInterval: 30_000,
  });
}

export function useCreateShoppingList(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateShoppingListInput) => createShoppingList(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', i18n.t('shopping:toast.listUpdated'));
    },
    onError: () => {
      addToast('error', i18n.t('shopping:toast.listUpdateFailed'));
    },
  });
}

export function useUpdateShoppingList(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ listId, input }: { listId: string; input: UpdateShoppingListInput }) =>
      updateShoppingList(listId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', i18n.t('shopping:toast.listUpdated'));
    },
    onError: () => {
      addToast('error', i18n.t('shopping:toast.listUpdateFailed'));
    },
  });
}

export function useArchiveShoppingList(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (listId: string) => archiveShoppingList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', i18n.t('shopping:toast.listArchived'));
    },
    onError: () => {
      addToast('error', i18n.t('shopping:toast.listArchiveFailed'));
    },
  });
}

export function useUnarchiveShoppingList(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (listId: string) => unarchiveShoppingList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', i18n.t('shopping:toast.listRestored'));
    },
    onError: () => {
      addToast('error', i18n.t('shopping:toast.listRestoreFailed'));
    },
  });
}

export function useDeleteShoppingList(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (listId: string) => deleteShoppingList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', i18n.t('shopping:toast.listDeleted'));
    },
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('shopping:toast.listDeleteFailed'));
    },
  });
}

