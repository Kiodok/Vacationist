import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSharedPackingItems,
  createSharedPackingItem,
  updateSharedPackingItem,
  claimSharedPackingItem,
  unclaimSharedPackingItem,
  softDeleteSharedPackingItem,
} from '@vacationist/api';
import type {
  CreateSharedPackingItemVariables,
  UpdateSharedPackingItemVariables,
  ClaimSharedPackingItemVariables,
  UnclaimSharedPackingItemVariables,
  DeleteSharedPackingItemVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useSharedPackingItems(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'shared-packing-items'],
    queryFn: () => getSharedPackingItems(tripId),
    retry: 2,
    enabled: !!tripId,
    refetchInterval: 30_000,
  });
}

export function useCreateSharedPackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['createSharedPackingItem', tripId],
    mutationFn: ({ input }: CreateSharedPackingItemVariables) => createSharedPackingItem(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shared-packing-items'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'packing-items'] });
    },
    onError: () => {
      addToast('error', i18n.t('stuff:toast.createFailed'));
    },
  });
}

export function useClaimSharedPackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['claimSharedPackingItem', tripId],
    mutationFn: ({ itemId }: ClaimSharedPackingItemVariables) => claimSharedPackingItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shared-packing-items'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'packing-items'] });
      addToast('success', i18n.t('stuff:toast.claimed'));
    },
    onError: () => {
      addToast('error', i18n.t('stuff:toast.claimFailed'));
    },
  });
}

export function useUnclaimSharedPackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['unclaimSharedPackingItem', tripId],
    mutationFn: ({ itemId }: UnclaimSharedPackingItemVariables) => unclaimSharedPackingItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shared-packing-items'] });
      addToast('success', i18n.t('stuff:toast.unclaimed'));
    },
    onError: () => {
      addToast('error', i18n.t('stuff:toast.unclaimFailed'));
    },
  });
}

export function useDeleteSharedPackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['deleteSharedPackingItem', tripId],
    mutationFn: ({ itemId }: DeleteSharedPackingItemVariables) => softDeleteSharedPackingItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shared-packing-items'] });
    },
    onError: () => {
      addToast('error', i18n.t('stuff:toast.deleteFailed'));
    },
  });
}

export function useUpdateSharedPackingItem(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['updateSharedPackingItem', tripId],
    mutationFn: ({ itemId, input }: UpdateSharedPackingItemVariables) =>
      updateSharedPackingItem(itemId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shared-packing-items'] });
    },
    onError: () => {
      addToast('error', i18n.t('stuff:toast.updateFailed'));
    },
  });
}
