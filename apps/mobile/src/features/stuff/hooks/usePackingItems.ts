import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPackingCategories,
  getPackingItems,
  createPackingItem,
  updatePackingItem,
  softDeletePackingItem,
  copyPackingListToTrip,
} from '@vacationist/api';
import type {
  PackingItem,
  CreatePackingItemVariables,
  UpdatePackingItemVariables,
  DeletePackingItemVariables,
  CopyPackingListVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function usePackingCategories() {
  return useQuery({
    queryKey: ['packing-categories'],
    queryFn: getPackingCategories,
    retry: 2,
    staleTime: Infinity,
  });
}

export function usePackingItems(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'packing-items'],
    queryFn: () => getPackingItems(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

// onSuccess (invalidation) lives in mutationDefaults so persisted mutations
// replay correctly after a cold start. Hooks keep onMutate/onError.

export function useCreatePackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<PackingItem, Error, CreatePackingItemVariables, { previous: PackingItem[] | undefined }>({
    mutationKey: ['createPackingItem', tripId],
    onMutate: async ({ tripId: tid, input }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tid, 'packing-items'] });
      const previous = queryClient.getQueryData<PackingItem[]>(['trips', tid, 'packing-items']);

      const now = new Date().toISOString();
      const optimistic: PackingItem = {
        id: createOptimisticId(),
        trip_id: tid,
        user_id: useAuthStore.getState().user?.id ?? '',
        category: input.category,
        title: input.title,
        is_packed: false,
        notes: input.notes ?? null,
        sort_order: 0,
        source_shared_item_id: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      queryClient.setQueryData<PackingItem[]>(
        ['trips', tid, 'packing-items'],
        (old) => [...(old ?? []), optimistic],
      );
      return { previous };
    },
    onError: (_err, { tripId: tid }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(['trips', tid, 'packing-items'], context.previous);
      }
      addToast('error', i18n.t('stuff:toast.createFailed'));
    },
  });
}

export function useUpdatePackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['updatePackingItem', tripId],
    mutationFn: ({ itemId, input }: UpdatePackingItemVariables) => updatePackingItem(itemId, input),
    onMutate: async ({ itemId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'packing-items'] });
      const previous = queryClient.getQueryData<PackingItem[]>(['trips', tripId, 'packing-items']);
      queryClient.setQueryData<PackingItem[]>(
        ['trips', tripId, 'packing-items'],
        (old) => old?.map((item) => item.id === itemId ? { ...item, ...input } : item),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['trips', tripId, 'packing-items'], context.previous);
      }
      addToast('error', i18n.t('stuff:toast.updateFailed'));
    },
  });
}

export function useDeletePackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['deletePackingItem', tripId],
    mutationFn: ({ itemId }: DeletePackingItemVariables) => softDeletePackingItem(itemId),
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'packing-items'] });
      const previous = queryClient.getQueryData<PackingItem[]>(['trips', tripId, 'packing-items']);
      queryClient.setQueryData<PackingItem[]>(
        ['trips', tripId, 'packing-items'],
        (old) => old?.filter((item) => item.id !== itemId),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['trips', tripId, 'packing-items'], context.previous);
      }
      addToast('error', i18n.t('stuff:toast.deleteFailed'));
    },
  });
}

export function useCopyPackingList() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['copyPackingList'],
    mutationFn: ({ sourceTripId, targetTripId }: CopyPackingListVariables) =>
      copyPackingListToTrip(sourceTripId, targetTripId),
    onSuccess: () => {
      addToast('success', i18n.t('stuff:toast.copied'));
    },
    onError: () => {
      addToast('error', i18n.t('stuff:toast.copyFailed'));
    },
  });
}
