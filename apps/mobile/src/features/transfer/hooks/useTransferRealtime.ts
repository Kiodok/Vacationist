import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import { subscribeToTransferRealtime, unsubscribeFromTransfer } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  TransferFlight,
  TransferFlightVote,
  TransferFlightPassenger,
  TransferVehicle,
  TransferVehiclePassenger,
  TransferRental,
} from '@vacationist/types';

const BACKOFF_DELAYS = [2000, 5000, 10000, 30000];

export function useTransferRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffIndexRef = useRef(0);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromTransfer(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const reconcile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-vehicles'] });
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-rentals'] });
  }, [queryClient, tripId]);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToTransferRealtime(
      tripId,
      {
        // --- Flights ---
        onFlightInsert: (flight) => {
          queryClient.setQueryData<TransferFlight[]>(
            ['trips', tripId, 'transfer-flights'],
            (old) => {
              if (!old) return [flight];
              if (old.some((f) => f.id === flight.id)) return old;
              return [flight, ...old];
            },
          );
        },
        onFlightUpdate: (flight) => {
          if (flight.deleted_at) {
            queryClient.setQueryData<TransferFlight[]>(
              ['trips', tripId, 'transfer-flights'],
              (old) => old?.filter((f) => f.id !== flight.id),
            );
          } else {
            queryClient.setQueryData<TransferFlight[]>(
              ['trips', tripId, 'transfer-flights'],
              (old) => old?.map((f) => (f.id === flight.id ? flight : f)),
            );
          }
        },
        // --- Flight votes ---
        onVoteInsert: (vote) => {
          queryClient.setQueryData<TransferFlightVote[]>(
            ['transfer-flights', vote.flight_id, 'votes'],
            (old) => {
              if (!old) return [vote];
              if (old.some((v) => v.id === vote.id)) return old;
              return [...old.filter((v) => v.user_id !== vote.user_id), vote];
            },
          );
        },
        onVoteUpdate: (vote) => {
          queryClient.setQueryData<TransferFlightVote[]>(
            ['transfer-flights', vote.flight_id, 'votes'],
            (old) => {
              if (!old) return [vote];
              return [...old.filter((v) => v.user_id !== vote.user_id), vote];
            },
          );
        },
        onVoteDelete: (oldVote) => {
          if (oldVote.flight_id) {
            queryClient.setQueryData<TransferFlightVote[]>(
              ['transfer-flights', oldVote.flight_id, 'votes'],
              (old) => old?.filter((v) => v.id !== oldVote.id),
            );
          } else {
            queryClient.invalidateQueries({ queryKey: ['transfer-flights'] });
          }
        },
        // --- Flight passengers ---
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
        // --- Vehicles ---
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
        // --- Vehicle passengers ---
        onVehiclePassengerInsert: (passenger) => {
          queryClient.setQueryData<TransferVehiclePassenger[]>(
            ['transfer-vehicles', passenger.vehicle_id, 'passengers'],
            (old) => {
              if (!old) return [passenger];
              if (old.some((p) => p.id === passenger.id)) return old;
              return [...old, passenger];
            },
          );
        },
        onVehiclePassengerUpdate: (passenger) => {
          queryClient.setQueryData<TransferVehiclePassenger[]>(
            ['transfer-vehicles', passenger.vehicle_id, 'passengers'],
            (old) => old?.map((p) => (p.id === passenger.id ? passenger : p)),
          );
        },
        onVehiclePassengerDelete: (oldPassenger) => {
          if (oldPassenger.vehicle_id) {
            queryClient.setQueryData<TransferVehiclePassenger[]>(
              ['transfer-vehicles', oldPassenger.vehicle_id, 'passengers'],
              (old) => old?.filter((p) => p.id !== oldPassenger.id),
            );
          }
        },
        // --- Rentals ---
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
