import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import { subscribeToActivityVotingRealtime, unsubscribeFromActivityVoting } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Activity, ActivityVote } from '@vacationist/types';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

export function useActivityVotesRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromActivityVoting(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const reconcile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'activities'] });
    queryClient.invalidateQueries({ queryKey: ['activities'] });
  }, [queryClient, tripId]);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToActivityVotingRealtime(
      tripId,
      {
        onVoteInsert: (vote) => {
          queryClient.setQueryData<ActivityVote[]>(
            ['activities', vote.activity_id, 'votes'],
            (old) => {
              if (!old) return [vote];
              if (old.some((v) => v.id === vote.id)) return old;
              const withoutUser = old.filter((v) => v.user_id !== vote.user_id);
              return [...withoutUser, vote];
            },
          );
          queryClient.invalidateQueries({ queryKey: ['activity-votes-batch'] });
        },
        onVoteUpdate: (vote) => {
          queryClient.setQueryData<ActivityVote[]>(
            ['activities', vote.activity_id, 'votes'],
            (old) => {
              if (!old) return [vote];
              if (old.some((v) => v.id === vote.id)) return old;
              const withoutUser = old.filter((v) => v.user_id !== vote.user_id);
              return [...withoutUser, vote];
            },
          );
          queryClient.invalidateQueries({ queryKey: ['activity-votes-batch'] });
        },
        onVoteDelete: (oldVote) => {
          if (oldVote.activity_id) {
            queryClient.setQueryData<ActivityVote[]>(
              ['activities', oldVote.activity_id, 'votes'],
              (old) => old?.filter((v) => v.id !== oldVote.id),
            );
            queryClient.invalidateQueries({
              queryKey: ['activities', oldVote.activity_id, 'votes'],
            });
          } else {
            queryClient.invalidateQueries({ queryKey: ['activities'] });
          }
          queryClient.invalidateQueries({ queryKey: ['activity-votes-batch'] });
        },
        onActivityUpdate: (activity) => {
          queryClient.setQueryData<Activity[]>(
            ['trips', tripId, 'activities'],
            (old) => old?.map((a) => (a.id === activity.id ? activity : a)),
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
