import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import { subscribeToAccommodationVotingRealtime, unsubscribeFromAccommodationVoting } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Accommodation, AccommodationVote } from '@vacationist/types';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

export function useAccommodationVotesRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromAccommodationVoting(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const reconcile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'accommodations'] });
    queryClient.invalidateQueries({ queryKey: ['accommodations'] });
  }, [queryClient, tripId]);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToAccommodationVotingRealtime(
      tripId,
      {
        onVoteInsert: (vote) => {
          queryClient.setQueryData<AccommodationVote[]>(
            ['accommodations', vote.accommodation_id, 'votes'],
            (old) => {
              if (!old) return [vote];
              if (old.some((v) => v.id === vote.id)) return old;
              const withoutUser = old.filter((v) => v.user_id !== vote.user_id);
              return [...withoutUser, vote];
            },
          );
        },
        onVoteUpdate: (vote) => {
          queryClient.setQueryData<AccommodationVote[]>(
            ['accommodations', vote.accommodation_id, 'votes'],
            (old) => {
              if (!old) return [vote];
              if (old.some((v) => v.id === vote.id)) return old;
              const withoutUser = old.filter((v) => v.user_id !== vote.user_id);
              return [...withoutUser, vote];
            },
          );
        },
        onVoteDelete: (oldVote) => {
          if (oldVote.accommodation_id) {
            queryClient.setQueryData<AccommodationVote[]>(
              ['accommodations', oldVote.accommodation_id, 'votes'],
              (old) => old?.filter((v) => v.id !== oldVote.id),
            );
            queryClient.invalidateQueries({
              queryKey: ['accommodations', oldVote.accommodation_id, 'votes'],
            });
          } else {
            queryClient.invalidateQueries({ queryKey: ['accommodations'] });
          }
        },
        onAccommodationUpdate: (accommodation) => {
          queryClient.setQueryData<Accommodation[]>(
            ['trips', tripId, 'accommodations'],
            (old) => old?.map((a) => (a.id === accommodation.id ? accommodation : a)),
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
