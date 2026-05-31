import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import { subscribeToRentalRealtime, unsubscribeFromRentalRealtime } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TransferRental } from '@vacationist/types';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

export function useTransferRentalRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromRentalRealtime(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const reconcile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-rentals'] });
  }, [queryClient, tripId]);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToRentalRealtime(
      tripId,
      {
        onRentalInsert: (rental) => {
          queryClient.setQueryData<TransferRental[]>(
            ['trips', tripId, 'transfer-rentals'],
            (old) => {
              if (!old) return [rental];
              if (old.some((r) => r.id === rental.id)) return old;
              return [rental, ...old];
            },
          );
        },
        onRentalUpdate: (rental) => {
          if (rental.deleted_at) {
            queryClient.setQueryData<TransferRental[]>(
              ['trips', tripId, 'transfer-rentals'],
              (old) => old?.filter((r) => r.id !== rental.id),
            );
          } else {
            queryClient.setQueryData<TransferRental[]>(
              ['trips', tripId, 'transfer-rentals'],
              (old) => old?.map((r) => (r.id === rental.id ? rental : r)),
            );
          }
        },
        onRentalDelete: (oldRental) => {
          queryClient.setQueryData<TransferRental[]>(
            ['trips', tripId, 'transfer-rentals'],
            (old) => old?.filter((r) => r.id !== oldRental.id),
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
