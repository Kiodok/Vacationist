import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import {
  subscribeToPreworkRealtime,
  unsubscribeFromPrework,
  subscribeToPreworkTopicsRealtime,
  unsubscribeFromPreworkTopics,
} from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PreworkPreferences, PreworkTopic } from '@vacationist/types';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

// Realtime for prework_preferences — scoped to a trip, updates topic-keyed caches
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

  const reconcile = useCallback((topicId?: string) => {
    if (topicId) {
      queryClient.invalidateQueries({ queryKey: ['prework-topics', topicId, 'preferences'] });
      queryClient.invalidateQueries({ queryKey: ['prework-topics', topicId, 'my-preferences'] });
    } else {
      // On reconnect without specific topic, invalidate all topic preference caches for this trip
      queryClient.invalidateQueries({ queryKey: ['prework-topics'] });
    }
  }, [queryClient]);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToPreworkRealtime(
      tripId,
      {
        onInsert: (pref) => {
          queryClient.setQueryData<PreworkPreferences[]>(
            ['prework-topics', pref.topic_id, 'preferences'],
            (old) => {
              if (!old) return [pref];
              if (old.some((p) => p.id === pref.id)) return old;
              return [...old, pref];
            },
          );
        },
        onUpdate: (pref) => {
          queryClient.setQueryData<PreworkPreferences[]>(
            ['prework-topics', pref.topic_id, 'preferences'],
            (old) => old?.map((p) => (p.id === pref.id ? pref : p)),
          );
          queryClient.setQueryData<PreworkPreferences | null>(
            ['prework-topics', pref.topic_id, 'my-preferences'],
            (old) => (old && old.id === pref.id ? pref : old),
          );
        },
        onDelete: (oldPref) => {
          if (oldPref.topic_id) {
            queryClient.setQueryData<PreworkPreferences[]>(
              ['prework-topics', oldPref.topic_id, 'preferences'],
              (old) => old?.filter((p) => p.id !== oldPref.id),
            );
            queryClient.setQueryData<PreworkPreferences | null>(
              ['prework-topics', oldPref.topic_id, 'my-preferences'],
              (old) => (old && old.id === oldPref.id ? null : old),
            );
          } else {
            // topic_id not in payload (REPLICA IDENTITY DEFAULT) — invalidate all
            reconcile();
          }
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

  useAppForeground(() => {
    subscribe();
    reconcile();
  }, !!tripId);

  useEffect(() => {
    if (!tripId) return;
    subscribe();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, subscribe, cleanup]);
}

// Realtime for prework_topics — scoped to a trip
export function usePreworkTopicsRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromPreworkTopics(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const reconcile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'prework-topics'] });
  }, [queryClient, tripId]);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToPreworkTopicsRealtime(
      tripId,
      {
        onInsert: (topic) => {
          queryClient.setQueryData<PreworkTopic[]>(
            ['trips', tripId, 'prework-topics'],
            (old) => {
              if (!old) return [topic];
              if (old.some((t) => t.id === topic.id)) return old;
              return [...old, topic].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
            },
          );
        },
        onUpdate: (topic) => {
          queryClient.setQueryData<PreworkTopic[]>(
            ['trips', tripId, 'prework-topics'],
            (old) => old?.map((t) => (t.id === topic.id ? topic : t)),
          );
        },
        onDelete: (oldTopic) => {
          queryClient.setQueryData<PreworkTopic[]>(
            ['trips', tripId, 'prework-topics'],
            (old) => old?.filter((t) => t.id !== oldTopic.id),
          );
          // Invalidate preference caches for the deleted topic
          queryClient.removeQueries({ queryKey: ['prework-topics', oldTopic.id] });
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

  useAppForeground(() => {
    subscribe();
    reconcile();
  }, !!tripId);

  useEffect(() => {
    if (!tripId) return;
    subscribe();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, subscribe, cleanup]);
}
