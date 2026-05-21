import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToCalendarActivitiesRealtime, unsubscribeFromCalendarActivities } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useGlobalCalendarRealtime(tripIds: string[]) {
  const queryClient = useQueryClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const sortedKey = tripIds.slice().sort().join(',');

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['global-calendar-activities'] });
  }, [queryClient]);

  const cleanup = useCallback(() => {
    for (const ch of channelsRef.current) {
      unsubscribeFromCalendarActivities(ch);
    }
    channelsRef.current = [];
  }, []);

  const subscribe = useCallback(() => {
    cleanup();
    const callbacks = {
      onActivityInsert: invalidate,
      onActivityUpdate: invalidate,
      onActivityDelete: invalidate,
    };
    for (const tripId of tripIds) {
      const channel = subscribeToCalendarActivitiesRealtime(tripId, callbacks);
      channelsRef.current.push(channel);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedKey, cleanup, invalidate]);

  useEffect(() => {
    if (tripIds.length === 0) return;

    subscribe();

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        subscribe();
        invalidate();
      }
    });

    return () => {
      cleanup();
      appStateSub.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedKey, subscribe, cleanup, invalidate]);
}
