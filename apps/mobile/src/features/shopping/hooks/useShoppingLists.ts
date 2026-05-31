import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getShoppingLists,
  createShoppingList,
  updateShoppingList,
  archiveShoppingList,
  unarchiveShoppingList,
  deleteShoppingList,
} from '@vacationist/api';
import type {
  CreateShoppingListVariables,
  UpdateShoppingListVariables,
  ArchiveShoppingListVariables,
  UnarchiveShoppingListVariables,
  DeleteShoppingListVariables,
} from '@vacationist/types';
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

export function useCreateShoppingList() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['createShoppingList'],
    mutationFn: ({ tripId, input }: CreateShoppingListVariables) => createShoppingList(tripId, input),
    onError: () => {
      addToast('error', i18n.t('shopping:toast.listUpdateFailed'));
    },
  });
}

export function useUpdateShoppingList() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['updateShoppingList'],
    mutationFn: ({ listId, input }: UpdateShoppingListVariables) => updateShoppingList(listId, input),
    onError: () => {
      addToast('error', i18n.t('shopping:toast.listUpdateFailed'));
    },
  });
}

export function useArchiveShoppingList() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['archiveShoppingList'],
    mutationFn: ({ listId }: ArchiveShoppingListVariables) => archiveShoppingList(listId),
    onError: () => {
      addToast('error', i18n.t('shopping:toast.listArchiveFailed'));
    },
  });
}

export function useUnarchiveShoppingList() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['unarchiveShoppingList'],
    mutationFn: ({ listId }: UnarchiveShoppingListVariables) => unarchiveShoppingList(listId),
    onError: () => {
      addToast('error', i18n.t('shopping:toast.listRestoreFailed'));
    },
  });
}

export function useDeleteShoppingList() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['deleteShoppingList'],
    mutationFn: ({ listId }: DeleteShoppingListVariables) => deleteShoppingList(listId),
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('shopping:toast.listDeleteFailed'));
    },
  });
}
