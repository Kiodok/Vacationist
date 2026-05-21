import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToPreworkRealtime, unsubscribeFromPrework } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PreworkPreferences } from '@vacationist/types';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

export function usePreworkRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromPrework(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const reconcile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'prework-preferences'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'my-prework-preferences'] });
  }, [queryClient, tripId]);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToPreworkRealtime(
      tripId,
      {
        onInsert: (pref) => {
          queryClient.setQueryData<PreworkPreferences[]>(
            ['trips', tripId, 'prework-preferences'],
            (old) => {
              if (!old) return [pref];
              if (old.some((p) => p.id === pref.id)) return old;
              return [...old, pref];
            },
          );
        },
        onUpdate: (pref) => {
          queryClient.setQueryData<PreworkPreferences[]>(
            ['trips', tripId, 'prework-preferences'],
            (old) => old?.map((p) => (p.id === pref.id ? pref : p)),
          );
          queryClient.setQueryData<PreworkPreferences | null>(
            ['trips', tripId, 'my-prework-preferences'],
            (old) => (old && old.id === pref.id ? pref : old),
          );
        },
        onDelete: (oldPref) => {
          queryClient.setQueryData<PreworkPreferences[]>(
            ['trips', tripId, 'prework-preferences'],
            (old) => old?.filter((p) => p.id !== oldPref.id),
          );
          queryClient.setQueryData<PreworkPreferences | null>(
            ['trips', tripId, 'my-prework-preferences'],
            (old) => (old && old.id === oldPref.id ? null : old),
          );
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
