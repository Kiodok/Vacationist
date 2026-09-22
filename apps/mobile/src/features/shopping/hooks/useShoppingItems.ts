import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
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
import {
  addOptimisticShoppingItem,
  patchShoppingItem,
  removeShoppingItem,
  snapshotShoppingCaches,
  restoreShoppingCaches,
  findShoppingItemListId,
  shoppingItemsKey,
  allShoppingItemsKey,
  type ShoppingCacheSnapshot,
} from '../utils/shoppingItemCache';

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

  return useMutation<ShoppingItem, Error, CreateShoppingItemVariables, { previous: ShoppingCacheSnapshot }>({
    mutationKey: ['createShoppingItem'],
    // mutationFn + onSuccess (resolve optimistic row + invalidate) live in mutationDefaults
    // so a queued offline add replays correctly after a cold start.
    onMutate: async ({ listId, tripId, input, id }) => {
      await cancelShoppingQueries(queryClient, listId, tripId);
      const previous = snapshotShoppingCaches(queryClient, listId, tripId);
      // Writes BOTH the list's cache and the All Items cache — see shoppingItemCache.ts. `id` is the
      // client-minted UUID (also sent to the server), so the row never changes identity.
      addOptimisticShoppingItem(queryClient, {
        optimisticId: id ?? createOptimisticId(),
        listId,
        tripId,
        title: input.title,
        createdBy: useAuthStore.getState().user?.id ?? '',
      });
      return { previous };
    },
    onError: (_err, { listId, tripId }, context) => {
      if (context !== undefined) restoreShoppingCaches(queryClient, listId, tripId, context.previous);
      addToast('error', i18n.t('shopping:toast.itemAddFailed'));
    },
  });
}

async function cancelShoppingQueries(queryClient: QueryClient, listId: string | undefined, tripId: string) {
  await Promise.all([
    listId ? queryClient.cancelQueries({ queryKey: shoppingItemsKey(listId) }) : Promise.resolve(),
    queryClient.cancelQueries({ queryKey: allShoppingItemsKey(tripId) }),
  ]);
}

export function useUpdateShoppingItem() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['updateShoppingItem'],
    mutationFn: ({ itemId, input }: UpdateShoppingItemVariables) => updateShoppingItem(itemId, input),
    onMutate: async ({ itemId, listId, tripId, input }: UpdateShoppingItemVariables) => {
      await cancelShoppingQueries(queryClient, listId, tripId);
      const previous = snapshotShoppingCaches(queryClient, listId, tripId);
      patchShoppingItem(queryClient, { itemId, listId, tripId, patch: input });
      return { previous };
    },
    onError: (_err, vars, context) => {
      if (context) restoreShoppingCaches(queryClient, vars.listId, vars.tripId, context.previous);
      addToast('error', i18n.t('shopping:toast.itemUpdateFailed'));
    },
  });
}

export function useUpdateShoppingItemGlobal() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<ShoppingItem, Error, UpdateShoppingItemGlobalVariables, { previous: ShoppingCacheSnapshot; listId: string | undefined }>({
    mutationKey: ['updateShoppingItemGlobal'],
    // mutationFn + onSuccess in mutationDefaults for cold-start replay.
    onMutate: async ({ itemId, tripId, input }) => {
      // The All Items screen carries no list id — look it up so the list's own cache is patched too
      // (it used to go stale after a toggle made here).
      const listId = findShoppingItemListId(queryClient, tripId, itemId);
      await cancelShoppingQueries(queryClient, listId, tripId);
      const previous = snapshotShoppingCaches(queryClient, listId, tripId);
      patchShoppingItem(queryClient, { itemId, listId, tripId, patch: input });
      return { previous, listId };
    },
    onError: (_err, { tripId }, context) => {
      if (context !== undefined) restoreShoppingCaches(queryClient, context.listId, tripId, context.previous);
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
    onMutate: async ({ itemId, listId, tripId }: DeleteShoppingItemVariables) => {
      await cancelShoppingQueries(queryClient, listId, tripId);
      const previous = snapshotShoppingCaches(queryClient, listId, tripId);
      removeShoppingItem(queryClient, { itemId, listId, tripId });
      return { previous };
    },
    onError: (_err, vars, context) => {
      if (context) restoreShoppingCaches(queryClient, vars.listId, vars.tripId, context.previous);
      addToast('error', i18n.t('shopping:toast.itemDeleteFailed'));
    },
  });
}
