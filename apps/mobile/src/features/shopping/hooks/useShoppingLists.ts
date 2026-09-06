import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShoppingLists,
  updateShoppingList,
  archiveShoppingList,
  unarchiveShoppingList,
  deleteShoppingList,
} from '@vacationist/api';
import type {
  ShoppingListWithCounts,
  CreateShoppingListVariables,
  UpdateShoppingListVariables,
  ArchiveShoppingListVariables,
  UnarchiveShoppingListVariables,
  DeleteShoppingListVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId, isOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

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
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<ShoppingListWithCounts, Error, CreateShoppingListVariables, { previous: ShoppingListWithCounts[] | undefined }>({
    mutationKey: ['createShoppingList'],
    // mutationFn + onSuccess (resolve optimistic + toast) in mutationDefaults for replay.
    onMutate: async ({ tripId, input }) => {
      const key = ['trips', tripId, 'shopping-lists'];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShoppingListWithCounts[]>(key);
      const now = new Date().toISOString();
      const optimistic: ShoppingListWithCounts = {
        id: createOptimisticId(),
        trip_id: tripId,
        title: input.title,
        created_by: useAuthStore.getState().user?.id ?? '',
        created_at: now,
        updated_at: now,
        archived_at: null,
        item_count: 0,
        bought_count: 0,
      };
      queryClient.setQueryData<ShoppingListWithCounts[]>(key, (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'shopping-lists'], context.previous);
      }
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
