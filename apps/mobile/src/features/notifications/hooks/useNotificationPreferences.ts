import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotificationPreferences, updateNotificationPreferences } from '@vacationist/api';
import type { NotificationPreference, UpdateNotificationPreferencesInput } from '@vacationist/types';

export function useNotificationPreferences(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'notification-preferences'],
    queryFn: () => getNotificationPreferences(tripId),
    enabled: !!tripId,
  });
}

export function useUpdateNotificationPreferences(tripId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prefs: UpdateNotificationPreferencesInput) =>
      updateNotificationPreferences(tripId, prefs),
    onMutate: async (prefs) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'notification-preferences'] });
      const prev = queryClient.getQueryData<NotificationPreference>(
        ['trips', tripId, 'notification-preferences']
      );
      queryClient.setQueryData<NotificationPreference>(
        ['trips', tripId, 'notification-preferences'],
        (old) => (old ? { ...old, ...prefs } : old)
      );
      return { prev };
    },
    onError: (_err, _prefs, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['trips', tripId, 'notification-preferences'], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notification-preferences'] });
    },
  });
}
