import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShoppingLists,
  createShoppingList,
  updateShoppingList,
  archiveShoppingList,
  unarchiveShoppingList,
  deleteShoppingList,
  subscribeToShoppingItemChanges,
  unsubscribeFromShoppingItems,
} from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CreateShoppingListInput, UpdateShoppingListInput } from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';

export function useShoppingLists(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'shopping-lists'],
    queryFn: () => getShoppingLists(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useCreateShoppingList(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateShoppingListInput) => createShoppingList(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', 'List created');
    },
    onError: () => {
      addToast('error', 'Failed to create list.');
    },
  });
}

export function useUpdateShoppingList(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ listId, input }: { listId: string; input: UpdateShoppingListInput }) =>
      updateShoppingList(listId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', 'List updated');
    },
    onError: () => {
      addToast('error', 'Failed to update list.');
    },
  });
}

export function useArchiveShoppingList(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (listId: string) => archiveShoppingList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', 'List archived');
    },
    onError: () => {
      addToast('error', 'Failed to archive list.');
    },
  });
}

export function useUnarchiveShoppingList(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (listId: string) => unarchiveShoppingList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', 'List restored');
    },
    onError: () => {
      addToast('error', 'Failed to restore list.');
    },
  });
}

export function useDeleteShoppingList(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (listId: string) => deleteShoppingList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      addToast('success', 'List deleted');
    },
    onError: (error: Error) => {
      addToast('error', error.message || 'Failed to delete list.');
    },
  });
}

export function useShoppingListsRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!tripId) return;

    channelRef.current = subscribeToShoppingItemChanges(tripId, () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'all-shopping-items'] });
    });

    return () => {
      if (channelRef.current) {
        unsubscribeFromShoppingItems(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tripId, queryClient]);
}
