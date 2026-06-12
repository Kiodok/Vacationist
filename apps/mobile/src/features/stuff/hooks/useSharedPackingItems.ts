import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSharedPackingItems } from '@vacationist/api';
import type {
  SharedPackingItem,
  CreateSharedPackingItemVariables,
  UpdateSharedPackingItemVariables,
  ClaimSharedPackingItemVariables,
  UnclaimSharedPackingItemVariables,
  DeleteSharedPackingItemVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useSharedPackingItems(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'shared-packing-items'],
    queryFn: () => getSharedPackingItems(tripId),
    retry: 2,
    enabled: !!tripId,
    refetchInterval: 30_000,
  });
}

// mutationFn + onSuccess (invalidation + toast) live in mutationDefaults so
// persisted mutations replay correctly after a cold start. Hooks keep
// onMutate (optimistic update) and onError (rollback + toast).

type ItemsContext = { previous: SharedPackingItem[] | undefined };

function itemsKey(tripId: string) {
  return ['trips', tripId, 'shared-packing-items'] as const;
}

export function useCreateSharedPackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<SharedPackingItem, Error, CreateSharedPackingItemVariables, ItemsContext>({
    mutationKey: ['createSharedPackingItem', tripId],
    onMutate: async ({ tripId: tid, input }) => {
      await queryClient.cancelQueries({ queryKey: itemsKey(tid) });
      const previous = queryClient.getQueryData<SharedPackingItem[]>(itemsKey(tid));

      const now = new Date().toISOString();
      const optimistic: SharedPackingItem = {
        id: createOptimisticId(),
        trip_id: tid,
        title: input.title,
        item_type: input.item_type,
        notes: input.notes ?? null,
        created_by: useAuthStore.getState().user?.id ?? '',
        claimed_by: null,
        is_resolved: false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      queryClient.setQueryData<SharedPackingItem[]>(itemsKey(tid), (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, { tripId: tid }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(itemsKey(tid), context.previous);
      }
      addToast('error', i18n.t('stuff:toast.createFailed'));
    },
  });
}

export function useClaimSharedPackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, ClaimSharedPackingItemVariables, ItemsContext>({
    mutationKey: ['claimSharedPackingItem', tripId],
    onMutate: async ({ itemId, tripId: tid }) => {
      await queryClient.cancelQueries({ queryKey: itemsKey(tid) });
      const previous = queryClient.getQueryData<SharedPackingItem[]>(itemsKey(tid));
      const userId = useAuthStore.getState().user?.id ?? '';
      queryClient.setQueryData<SharedPackingItem[]>(
        itemsKey(tid),
        (old) => old?.map((i) => (i.id === itemId ? { ...i, claimed_by: userId } : i)),
      );
      return { previous };
    },
    onError: (_err, { tripId: tid }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(itemsKey(tid), context.previous);
      }
      addToast('error', i18n.t('stuff:toast.claimFailed'));
    },
  });
}

export function useUnclaimSharedPackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, UnclaimSharedPackingItemVariables, ItemsContext>({
    mutationKey: ['unclaimSharedPackingItem', tripId],
    onMutate: async ({ itemId, tripId: tid }) => {
      await queryClient.cancelQueries({ queryKey: itemsKey(tid) });
      const previous = queryClient.getQueryData<SharedPackingItem[]>(itemsKey(tid));
      queryClient.setQueryData<SharedPackingItem[]>(
        itemsKey(tid),
        (old) => old?.map((i) => (i.id === itemId ? { ...i, claimed_by: null } : i)),
      );
      return { previous };
    },
    onError: (_err, { tripId: tid }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(itemsKey(tid), context.previous);
      }
      addToast('error', i18n.t('stuff:toast.unclaimFailed'));
    },
  });
}

export function useDeleteSharedPackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, DeleteSharedPackingItemVariables, ItemsContext>({
    mutationKey: ['deleteSharedPackingItem', tripId],
    onMutate: async ({ itemId, tripId: tid }) => {
      await queryClient.cancelQueries({ queryKey: itemsKey(tid) });
      const previous = queryClient.getQueryData<SharedPackingItem[]>(itemsKey(tid));
      queryClient.setQueryData<SharedPackingItem[]>(
        itemsKey(tid),
        (old) => old?.filter((i) => i.id !== itemId),
      );
      return { previous };
    },
    onError: (_err, { tripId: tid }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(itemsKey(tid), context.previous);
      }
      addToast('error', i18n.t('stuff:toast.deleteFailed'));
    },
  });
}

export function useUpdateSharedPackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<SharedPackingItem, Error, UpdateSharedPackingItemVariables, ItemsContext>({
    mutationKey: ['updateSharedPackingItem', tripId],
    onMutate: async ({ itemId, tripId: tid, input }) => {
      await queryClient.cancelQueries({ queryKey: itemsKey(tid) });
      const previous = queryClient.getQueryData<SharedPackingItem[]>(itemsKey(tid));
      queryClient.setQueryData<SharedPackingItem[]>(
        itemsKey(tid),
        (old) => old?.map((i) => (i.id === itemId ? { ...i, ...input } : i)),
      );
      return { previous };
    },
    onError: (_err, { tripId: tid }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(itemsKey(tid), context.previous);
      }
      addToast('error', i18n.t('stuff:toast.updateFailed'));
    },
  });
}
