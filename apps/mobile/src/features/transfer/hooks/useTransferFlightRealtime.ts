import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToFlightVotingRealtime, unsubscribeFromFlightVoting } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TransferFlight, TransferFlightVote, TransferFlightPassenger } from '@vacationist/types';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

export function useTransferFlightRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromFlightVoting(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const reconcile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
    queryClient.invalidateQueries({ queryKey: ['transfer-flights'] });
  }, [queryClient, tripId]);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToFlightVotingRealtime(
      tripId,
      {
        onVoteInsert: (vote) => {
          queryClient.setQueryData<TransferFlightVote[]>(
            ['transfer-flights', vote.flight_id, 'votes'],
            (old) => {
              if (!old) return [vote];
              if (old.some((v) => v.id === vote.id)) return old;
              const withoutUser = old.filter((v) => v.user_id !== vote.user_id);
              return [...withoutUser, vote];
            },
          );
        },
        onVoteUpdate: (vote) => {
          queryClient.setQueryData<TransferFlightVote[]>(
            ['transfer-flights', vote.flight_id, 'votes'],
            (old) => {
              if (!old) return [vote];
              const withoutUser = old.filter((v) => v.user_id !== vote.user_id);
              return [...withoutUser, vote];
            },
          );
        },
        onVoteDelete: (oldVote) => {
          if (oldVote.flight_id) {
            queryClient.setQueryData<TransferFlightVote[]>(
              ['transfer-flights', oldVote.flight_id, 'votes'],
              (old) => old?.filter((v) => v.id !== oldVote.id),
            );
            queryClient.invalidateQueries({
              queryKey: ['transfer-flights', oldVote.flight_id, 'votes'],
            });
          } else {
            queryClient.invalidateQueries({ queryKey: ['transfer-flights'] });
          }
        },
        onFlightUpdate: (flight) => {
          queryClient.setQueryData<TransferFlight[]>(
            ['trips', tripId, 'transfer-flights'],
            (old) => old?.map((f) => (f.id === flight.id ? flight : f)),
          );
        },
        onPassengerInsert: (passenger) => {
          queryClient.invalidateQueries({
            queryKey: ['transfer-flights', passenger.flight_id, 'passengers'],
          });
        },
        onPassengerDelete: (oldPassenger) => {
          if (oldPassenger.flight_id) {
            queryClient.invalidateQueries({
              queryKey: ['transfer-flights', oldPassenger.flight_id, 'passengers'],
            });
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
