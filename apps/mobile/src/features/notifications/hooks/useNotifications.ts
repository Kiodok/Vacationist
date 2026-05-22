import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getTripNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@vacationist/api';
import type { Notification } from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(),
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useTripNotifications(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'notifications'],
    queryFn: () => getTripNotifications(tripId),
    refetchInterval: 30_000,
    retry: 2,
    enabled: !!tripId,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}

export function useMarkAllNotificationsRead(tripId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsRead(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notifications'] });
        queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notifications', 'unread-count'] });
      }
    },
  });
}

export function useDeleteNotification(tripId?: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (notificationId: string) => deleteNotification(notificationId),
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      if (tripId) {
        await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'notifications'] });
      }
      const prev = queryClient.getQueryData<Notification[]>(['notifications']);
      queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
        old ? old.filter((n) => n.id !== notificationId) : []
      );
      if (tripId) {
        const prevTrip = queryClient.getQueryData<Notification[]>(['trips', tripId, 'notifications']);
        queryClient.setQueryData<Notification[]>(['trips', tripId, 'notifications'], (old) =>
          old ? old.filter((n) => n.id !== notificationId) : []
        );
        return { prev, prevTrip };
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['notifications'], ctx.prev);
      if (ctx?.prevTrip && tripId) queryClient.setQueryData(['trips', tripId, 'notifications'], ctx.prevTrip);
      addToast('error', 'Failed to delete notification.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notifications', 'unread-count'] });
      }
    },
  });
}
