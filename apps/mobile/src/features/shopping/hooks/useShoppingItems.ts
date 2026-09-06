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
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

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
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<ShoppingItem, Error, CreateShoppingItemVariables, { previous: ShoppingItem[] | undefined }>({
    mutationKey: ['createShoppingItem'],
    // mutationFn + onSuccess (resolve optimistic row + invalidate) live in mutationDefaults
    // so a queued offline add replays correctly after a cold start.
    onMutate: async ({ listId, input }) => {
      const key = ['shopping-lists', listId, 'items'];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShoppingItem[]>(key);
      const now = new Date().toISOString();
      const optimistic: ShoppingItem = {
        id: createOptimisticId(),
        trip_id: '',
        shopping_list_id: listId,
        title: input.title,
        quantity: null,
        unit: null,
        notes: null,
        position: (previous?.length ?? 0),
        status: 'open',
        source_recipe_id: null,
        source_ingredient_id: null,
        created_by: useAuthStore.getState().user?.id ?? '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      queryClient.setQueryData<ShoppingItem[]>(key, (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, { listId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['shopping-lists', listId, 'items'], context.previous);
      }
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
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<ShoppingItem, Error, UpdateShoppingItemGlobalVariables, { previous: ShoppingItem[] | undefined }>({
    mutationKey: ['updateShoppingItemGlobal'],
    // mutationFn + onSuccess in mutationDefaults for cold-start replay.
    onMutate: async ({ itemId, tripId, input }) => {
      const key = ['trips', tripId, 'all-shopping-items'];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShoppingItem[]>(key);
      queryClient.setQueryData<ShoppingItem[]>(key, (old) =>
        old?.map((i) => (i.id === itemId ? { ...i, ...input } : i)),
      );
      return { previous };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tripId, 'all-shopping-items'], context.previous);
      }
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
