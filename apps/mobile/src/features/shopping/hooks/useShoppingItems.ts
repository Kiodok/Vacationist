import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShoppingItems,
  getAllShoppingItemsForTrip,
  createShoppingItem,
  updateShoppingItem,
  softDeleteShoppingItem,
} from '@vacationist/api';
import type {
  ShoppingItem,
  CreateShoppingItemVariables,
  UpdateShoppingItemVariables,
  UpdateShoppingItemGlobalVariables,
  DeleteShoppingItemVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useShoppingItems(listId: string) {
  return useQuery({
    queryKey: ['shopping-lists', listId, 'items'],
    queryFn: () => getShoppingItems(listId),
    retry: 2,
    enabled: !!listId,
  });
}

export function useAllTripShoppingItems(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'all-shopping-items'],
    queryFn: () => getAllShoppingItemsForTrip(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useCreateShoppingItem() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['createShoppingItem'],
    mutationFn: ({ listId, input }: CreateShoppingItemVariables) => createShoppingItem(listId, input),
    onError: () => {
      addToast('error', i18n.t('shopping:toast.itemAddFailed'));
    },
  });
}

export function useUpdateShoppingItem() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['updateShoppingItem'],
    mutationFn: ({ itemId, input }: UpdateShoppingItemVariables) => updateShoppingItem(itemId, input),
    onMutate: async ({ itemId, listId, input }: UpdateShoppingItemVariables) => {
      await queryClient.cancelQueries({ queryKey: ['shopping-lists', listId, 'items'] });

      const previous = queryClient.getQueryData<ShoppingItem[]>(['shopping-lists', listId, 'items']);

      queryClient.setQueryData<ShoppingItem[]>(
        ['shopping-lists', listId, 'items'],
        (old) => old?.map((item) => item.id === itemId ? { ...item, ...input } : item),
      );

      return { previous };
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['shopping-lists', vars.listId, 'items'], context.previous);
      }
      addToast('error', i18n.t('shopping:toast.itemUpdateFailed'));
    },
  });
}

export function useUpdateShoppingItemGlobal() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['updateShoppingItemGlobal'],
    mutationFn: ({ itemId, input }: UpdateShoppingItemGlobalVariables) => updateShoppingItem(itemId, input),
    onError: () => {
      addToast('error', i18n.t('shopping:toast.itemUpdateFailed'));
    },
  });
}

export function useDeleteShoppingItem() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['deleteShoppingItem'],
    mutationFn: ({ itemId }: DeleteShoppingItemVariables) => softDeleteShoppingItem(itemId),
    onMutate: async ({ itemId, listId }: DeleteShoppingItemVariables) => {
      await queryClient.cancelQueries({ queryKey: ['shopping-lists', listId, 'items'] });

      const previous = queryClient.getQueryData<ShoppingItem[]>(['shopping-lists', listId, 'items']);

      queryClient.setQueryData<ShoppingItem[]>(
        ['shopping-lists', listId, 'items'],
        (old) => old?.filter((item) => item.id !== itemId),
      );

      return { previous };
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['shopping-lists', vars.listId, 'items'], context.previous);
      }
      addToast('error', i18n.t('shopping:toast.itemDeleteFailed'));
    },
  });
}
