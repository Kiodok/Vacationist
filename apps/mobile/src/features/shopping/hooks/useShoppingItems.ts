import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShoppingItems,
  getAllShoppingItemsForTrip,
  createShoppingItem,
  updateShoppingItem,
  softDeleteShoppingItem,
} from '@vacationist/api';
import type { ShoppingItem, CreateShoppingItemInput, UpdateShoppingItemInput } from '@vacationist/types';
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

export function useCreateShoppingItem(tripId: string, listId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateShoppingItemInput) => createShoppingItem(listId, input),
    onSuccess: (newItem) => {
      queryClient.setQueryData<ShoppingItem[]>(
        ['shopping-lists', listId, 'items'],
        (old) => {
          if (!old) return [newItem];
          if (old.some((i) => i.id === newItem.id)) return old;
          return [...old, newItem];
        },
      );
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
    },
    onError: () => {
      addToast('error', i18n.t('shopping:toast.itemAddFailed'));
    },
  });
}

export function useUpdateShoppingItem(tripId: string, listId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateShoppingItemInput }) =>
      updateShoppingItem(itemId, input),
    onMutate: async ({ itemId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['shopping-lists', listId, 'items'] });

      const previous = queryClient.getQueryData<ShoppingItem[]>(['shopping-lists', listId, 'items']);

      queryClient.setQueryData<ShoppingItem[]>(
        ['shopping-lists', listId, 'items'],
        (old) =>
          old?.map((item) =>
            item.id === itemId ? { ...item, ...input } : item,
          ),
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['shopping-lists', listId, 'items'], context.previous);
      }
      addToast('error', i18n.t('shopping:toast.itemUpdateFailed'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
    },
  });
}

export function useUpdateShoppingItemGlobal(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateShoppingItemInput }) =>
      updateShoppingItem(itemId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'all-shopping-items'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
    },
    onError: () => {
      addToast('error', i18n.t('shopping:toast.itemUpdateFailed'));
    },
  });
}

export function useDeleteShoppingItem(tripId: string, listId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (itemId: string) => softDeleteShoppingItem(itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['shopping-lists', listId, 'items'] });

      const previous = queryClient.getQueryData<ShoppingItem[]>(['shopping-lists', listId, 'items']);

      queryClient.setQueryData<ShoppingItem[]>(
        ['shopping-lists', listId, 'items'],
        (old) => old?.filter((item) => item.id !== itemId),
      );

      return { previous };
    },
    onError: (_err, _itemId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['shopping-lists', listId, 'items'], context.previous);
      }
      addToast('error', i18n.t('shopping:toast.itemDeleteFailed'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', i18n.t('shopping:toast.itemRemoved'));
    },
  });
}
