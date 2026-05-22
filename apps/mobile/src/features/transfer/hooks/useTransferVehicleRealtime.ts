import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToVehicleRealtime, unsubscribeFromVehicleRealtime } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { TransferVehicle, TransferVehiclePassenger } from '@vacationist/types';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

export function useTransferVehicleRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromVehicleRealtime(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const reconcile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
    queryClient.invalidateQueries({ queryKey: ['transfer-vehicles'] });
  }, [queryClient, tripId]);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToVehicleRealtime(
      tripId,
      {
        onVehicleInsert: (vehicle) => {
          queryClient.setQueryData<TransferVehicle[]>(
            ['trips', tripId, 'transfer-vehicles'],
            (old) => {
              if (!old) return [vehicle];
              if (old.some((v) => v.id === vehicle.id)) return old;
              return [vehicle, ...old];
            },
          );
        },
        onVehicleUpdate: (vehicle) => {
          if (vehicle.deleted_at) {
            queryClient.setQueryData<TransferVehicle[]>(
              ['trips', tripId, 'transfer-vehicles'],
              (old) => old?.filter((v) => v.id !== vehicle.id),
            );
          } else {
            queryClient.setQueryData<TransferVehicle[]>(
              ['trips', tripId, 'transfer-vehicles'],
              (old) => old?.map((v) => (v.id === vehicle.id ? vehicle : v)),
            );
          }
        },
        onVehicleDelete: (oldVehicle) => {
          queryClient.setQueryData<TransferVehicle[]>(
            ['trips', tripId, 'transfer-vehicles'],
            (old) => old?.filter((v) => v.id !== oldVehicle.id),
          );
        },
        onPassengerInsert: (passenger) => {
          queryClient.setQueryData<TransferVehiclePassenger[]>(
            ['transfer-vehicles', passenger.vehicle_id, 'passengers'],
            (old) => {
              if (!old) return [passenger];
              if (old.some((p) => p.id === passenger.id)) return old;
              return [...old, passenger];
            },
          );
        },
        onPassengerUpdate: (passenger) => {
          queryClient.setQueryData<TransferVehiclePassenger[]>(
            ['transfer-vehicles', passenger.vehicle_id, 'passengers'],
            (old) => old?.map((p) => (p.id === passenger.id ? passenger : p)),
          );
        },
        onPassengerDelete: (oldPassenger) => {
          if (oldPassenger.vehicle_id) {
            queryClient.setQueryData<TransferVehiclePassenger[]>(
              ['transfer-vehicles', oldPassenger.vehicle_id, 'passengers'],
              (old) => old?.filter((p) => p.id !== oldPassenger.id),
            );
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
