import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToCalendarActivitiesRealtime, unsubscribeFromCalendarActivities } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

export function useCalendarRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromCalendarActivities(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const reconcile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
  }, [queryClient, tripId]);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToCalendarActivitiesRealtime(
      tripId,
      {
        onActivityInsert: () => {
          queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
        },
        onActivityUpdate: () => {
          queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
        },
        onActivityDelete: () => {
          queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
        },
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          backoffIndexRef.current = 0;
          reconcile();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const delay = BACKOFF_DELAYS[Math.min(backoffIndexRef.current, BACKOFF_DELAYS.length - 1)];
          backoffIndexRef.current++;
          reconnectTimerRef.current = setTimeout(() => {
            subscribe();
            reconcile();
          }, delay);
        }
      },
    );

    channelRef.current = channel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, queryClient, cleanup, reconcile]);

  useEffect(() => {
    if (!tripId) return;

    subscribe();

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        subscribe();
        reconcile();
      }
    });

    return () => {
      cleanup();
      appStateSubscription.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, subscribe, cleanup, reconcile]);
}
