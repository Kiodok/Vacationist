import { supabase } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  TransferVehicle,
  TransferVehiclePassenger,
  CreateTransferVehicleInput,
  UpdateTransferVehicleInput,
} from '@vacationist/types';

export async function getTransferVehicles(tripId: string): Promise<TransferVehicle[]> {
  const { data, error } = await supabase
    .from('transfer_vehicles')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('direction', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as TransferVehicle[];
}

export async function createTransferVehicle(tripId: string, input: CreateTransferVehicleInput): Promise<TransferVehicle> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('transfer_vehicles')
    .insert({
      trip_id: tripId,
      title: input.title,
      direction: input.direction,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferVehicle;
}

export async function updateTransferVehicle(vehicleId: string, input: UpdateTransferVehicleInput): Promise<TransferVehicle> {
  const { data, error } = await supabase
    .from('transfer_vehicles')
    .update(input)
    .eq('id', vehicleId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferVehicle;
}

export async function softDeleteTransferVehicle(vehicleId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_transfer_vehicle', { p_vehicle_id: vehicleId });
  if (error) throw error;
}

export async function getTransferVehiclePassengers(vehicleId: string): Promise<TransferVehiclePassenger[]> {
  const { data, error } = await supabase
    .from('transfer_vehicle_passengers')
    .select('*')
    .eq('vehicle_id', vehicleId);

  if (error) throw error;
  return data as unknown as TransferVehiclePassenger[];
}

export async function addTransferVehiclePassenger(
  vehicleId: string,
  userId: string,
  isDriver = false,
): Promise<TransferVehiclePassenger> {
  const { data, error } = await supabase
    .from('transfer_vehicle_passengers')
    .insert({ vehicle_id: vehicleId, user_id: userId, is_driver: isDriver })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferVehiclePassenger;
}

export async function removeTransferVehiclePassenger(vehicleId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('transfer_vehicle_passengers')
    .delete()
    .eq('vehicle_id', vehicleId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function updateTransferVehiclePassenger(
  vehicleId: string,
  userId: string,
  isDriver: boolean,
): Promise<TransferVehiclePassenger> {
  const { data, error } = await supabase
    .from('transfer_vehicle_passengers')
    .update({ is_driver: isDriver })
    .eq('vehicle_id', vehicleId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferVehiclePassenger;
}

export interface VehicleRealtimeCallbacks {
  onVehicleInsert: (vehicle: TransferVehicle) => void;
  onVehicleUpdate: (vehicle: TransferVehicle) => void;
  onVehicleDelete: (oldVehicle: TransferVehicle) => void;
  onPassengerInsert: (passenger: TransferVehiclePassenger) => void;
  onPassengerUpdate: (passenger: TransferVehiclePassenger) => void;
  onPassengerDelete: (oldPassenger: TransferVehiclePassenger) => void;
}

export function subscribeToVehicleRealtime(
  tripId: string,
  callbacks: VehicleRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  const uid = Math.random().toString(36).slice(2, 8);
  return supabase
    .channel(`transfer-vehicles:${tripId}:${uid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transfer_vehicles', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVehicleInsert(payload.new as unknown as TransferVehicle),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'transfer_vehicles', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVehicleUpdate(payload.new as unknown as TransferVehicle),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'transfer_vehicles', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVehicleDelete(payload.old as unknown as TransferVehicle),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transfer_vehicle_passengers', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onPassengerInsert(payload.new as unknown as TransferVehiclePassenger),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'transfer_vehicle_passengers', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onPassengerUpdate(payload.new as unknown as TransferVehiclePassenger),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'transfer_vehicle_passengers', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onPassengerDelete(payload.old as unknown as TransferVehiclePassenger),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromVehicleRealtime(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
