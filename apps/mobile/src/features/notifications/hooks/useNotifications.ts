import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import {
  getNotifications,
  getTripNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  subscribeToNotificationsRealtime,
  unsubscribeFromNotifications,
} from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Notification } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useAuthStore } from '../../../stores/authStore';
import { useToastStore } from '../../../stores/toastStore';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(),
    retry: 2,
    refetchInterval: 30_000,
  });
}

export function useTripNotifications(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'notifications'],
    queryFn: () => getTripNotifications(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useNotificationsRealtime() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromNotifications(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  }, [queryClient]);

  const subscribe = useCallback(() => {
    if (!userId) return;
    cleanup();

    const channel = subscribeToNotificationsRealtime(
      userId,
      {
        onInsert: (notification) => {
          queryClient.setQueryData<Notification[]>(['notifications'], (old) => {
            if (!old) return [notification];
            if (old.some((n) => n.id === notification.id)) return old;
            return [notification, ...old];
          });
          queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
          if (notification.trip_id) {
            queryClient.setQueryData<Notification[]>(
              ['trips', notification.trip_id, 'notifications'],
              (old) => {
                if (!old) return [notification];
                if (old.some((n) => n.id === notification.id)) return old;
                return [notification, ...old];
              },
            );
            queryClient.invalidateQueries({ queryKey: ['trips', notification.trip_id, 'notifications', 'unread-count'] });
          }
        },
        onUpdate: (notification) => {
          queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
            old?.map((n) => (n.id === notification.id ? notification : n)),
          );
          queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
          if (notification.trip_id) {
            queryClient.setQueryData<Notification[]>(
              ['trips', notification.trip_id, 'notifications'],
              (old) => old?.map((n) => (n.id === notification.id ? notification : n)),
            );
            queryClient.invalidateQueries({ queryKey: ['trips', notification.trip_id, 'notifications', 'unread-count'] });
          }
        },
        onDelete: (notification) => {
          queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
            old?.filter((n) => n.id !== notification.id),
          );
          if (notification.trip_id) {
            queryClient.setQueryData<Notification[]>(
              ['trips', notification.trip_id, 'notifications'],
              (old) => old?.filter((n) => n.id !== notification.id),
            );
          }
          if (!notification.is_read) {
            queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
            if (notification.trip_id) {
              queryClient.invalidateQueries({ queryKey: ['trips', notification.trip_id, 'notifications', 'unread-count'] });
            }
          }
        },
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          backoffIndexRef.current = 0;
          invalidate();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const delay = BACKOFF_DELAYS[Math.min(backoffIndexRef.current, BACKOFF_DELAYS.length - 1)];
          backoffIndexRef.current++;
          reconnectTimerRef.current = setTimeout(() => {
            subscribe();
            invalidate();
          }, delay);
        }
      },
    );

    channelRef.current = channel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, queryClient, cleanup, invalidate]);

  useAppForeground(() => {
    subscribe();
    invalidate();
  }, !!userId);

  useEffect(() => {
    if (!userId) return;
    subscribe();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, subscribe, cleanup]);
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
      addToast('error', i18n.t('notifications:toast.deleteFailed'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'notifications', 'unread-count'] });
      }
    },
  });
}
