import { supabase, freshChannel } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  TransferFlight,
  TransferFlightVote,
  TransferFlightPassenger,
  TransferVehicle,
  TransferVehiclePassenger,
  TransferRental,
} from '@vacationist/types';

export interface TransferRealtimeCallbacks {
  onFlightInsert: (flight: TransferFlight) => void;
  onFlightUpdate: (flight: TransferFlight) => void;
  onVoteInsert: (vote: TransferFlightVote) => void;
  onVoteUpdate: (vote: TransferFlightVote) => void;
  onVoteDelete: (oldVote: TransferFlightVote) => void;
  onPassengerInsert: (passenger: TransferFlightPassenger) => void;
  onPassengerDelete: (oldPassenger: TransferFlightPassenger) => void;
  onVehicleInsert: (vehicle: TransferVehicle) => void;
  onVehicleUpdate: (vehicle: TransferVehicle) => void;
  onVehicleDelete: (oldVehicle: TransferVehicle) => void;
  onVehiclePassengerInsert: (passenger: TransferVehiclePassenger) => void;
  onVehiclePassengerUpdate: (passenger: TransferVehiclePassenger) => void;
  onVehiclePassengerDelete: (oldPassenger: TransferVehiclePassenger) => void;
  onRentalInsert: (rental: TransferRental) => void;
  onRentalUpdate: (rental: TransferRental) => void;
  onRentalDelete: (oldRental: TransferRental) => void;
}

export function subscribeToTransferRealtime(
  tripId: string,
  callbacks: TransferRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  return freshChannel(`transfer:${tripId}`)
    // Flights
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transfer_flights', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onFlightInsert(p.new as unknown as TransferFlight))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transfer_flights', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onFlightUpdate(p.new as unknown as TransferFlight))
    // Flight votes
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transfer_flight_votes', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onVoteInsert(p.new as unknown as TransferFlightVote))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transfer_flight_votes', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onVoteUpdate(p.new as unknown as TransferFlightVote))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transfer_flight_votes', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onVoteDelete(p.old as unknown as TransferFlightVote))
    // Flight passengers
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transfer_flight_passengers', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onPassengerInsert(p.new as unknown as TransferFlightPassenger))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transfer_flight_passengers', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onPassengerDelete(p.old as unknown as TransferFlightPassenger))
    // Vehicles
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transfer_vehicles', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onVehicleInsert(p.new as unknown as TransferVehicle))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transfer_vehicles', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onVehicleUpdate(p.new as unknown as TransferVehicle))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transfer_vehicles', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onVehicleDelete(p.old as unknown as TransferVehicle))
    // Vehicle passengers
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transfer_vehicle_passengers', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onVehiclePassengerInsert(p.new as unknown as TransferVehiclePassenger))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transfer_vehicle_passengers', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onVehiclePassengerUpdate(p.new as unknown as TransferVehiclePassenger))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transfer_vehicle_passengers', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onVehiclePassengerDelete(p.old as unknown as TransferVehiclePassenger))
    // Rentals
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transfer_rentals', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onRentalInsert(p.new as unknown as TransferRental))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transfer_rentals', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onRentalUpdate(p.new as unknown as TransferRental))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transfer_rentals', filter: `trip_id=eq.${tripId}` },
      (p) => callbacks.onRentalDelete(p.old as unknown as TransferRental))
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromTransfer(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
