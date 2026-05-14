import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShoppingItems,
  createShoppingItem,
  updateShoppingItem,
  softDeleteShoppingItem,
} from '@vacationist/api';
import type { ShoppingItem, CreateShoppingItemInput, UpdateShoppingItemInput } from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';

export function useShoppingItems(listId: string) {
  return useQuery({
    queryKey: ['shopping-lists', listId, 'items'],
    queryFn: () => getShoppingItems(listId),
    retry: 2,
    enabled: !!listId,
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
        (old) => (old ? [...old, newItem] : [newItem]),
      );
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
    },
    onError: () => {
      addToast('error', 'Failed to add item.');
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
      addToast('error', 'Failed to update item.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
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
      addToast('error', 'Failed to delete item.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', 'Item removed');
    },
  });
}
