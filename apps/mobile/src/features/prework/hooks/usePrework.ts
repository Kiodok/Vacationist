import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPreworkPreferences,
  getMyPreworkPreferences,
  upsertPreworkPreferences,
  deletePreworkPreferences,
} from '@vacationist/api';
import type { UpsertPreworkPreferencesInput } from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';

export function usePreworkPreferences(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'prework-preferences'],
    queryFn: () => getPreworkPreferences(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useMyPreworkPreferences(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'my-prework-preferences'],
    queryFn: () => getMyPreworkPreferences(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useUpsertPreworkPreferences(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: UpsertPreworkPreferencesInput) =>
      upsertPreworkPreferences(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'prework-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'my-prework-preferences'] });
      addToast('success', 'Preferences saved');
    },
    onError: () => {
      addToast('error', 'Failed to save preferences');
    },
  });
}

export function useDeletePreworkPreferences(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: () => deletePreworkPreferences(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'prework-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'my-prework-preferences'] });
      addToast('success', 'Preferences cleared');
    },
    onError: () => {
      addToast('error', 'Failed to clear preferences');
    },
  });
}
