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
import { useToastStore } from '../../../stores/toastStore';

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

export function useCreatePackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['createPackingItem', tripId],
    mutationFn: ({ input }: CreatePackingItemVariables) => createPackingItem(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'packing-items'] });
    },
    onError: () => {
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
