import { supabase } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  TransferRental,
  CreateTransferRentalInput,
  UpdateTransferRentalInput,
} from '@vacationist/types';

export async function getTransferRentals(tripId: string): Promise<TransferRental[]> {
  const { data, error } = await supabase
    .from('transfer_rentals')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('pickup_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as TransferRental[];
}

export async function createTransferRental(tripId: string, input: CreateTransferRentalInput): Promise<TransferRental> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('transfer_rentals')
    .insert({
      trip_id: tripId,
      title: input.title,
      company: input.company ?? null,
      pickup_location: input.pickup_location ?? null,
      dropoff_location: input.dropoff_location ?? null,
      pickup_date: input.pickup_date ?? null,
      dropoff_date: input.dropoff_date ?? null,
      booking_reference: input.booking_reference ?? null,
      price_total: input.price_total ?? null,
      external_url: input.external_url ?? null,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferRental;
}

export async function updateTransferRental(rentalId: string, input: UpdateTransferRentalInput): Promise<TransferRental> {
  const { data, error } = await supabase
    .from('transfer_rentals')
    .update(input)
    .eq('id', rentalId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferRental;
}

export async function softDeleteTransferRental(rentalId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_transfer_rental', { p_rental_id: rentalId });
  if (error) throw error;
}

export interface RentalRealtimeCallbacks {
  onRentalInsert: (rental: TransferRental) => void;
  onRentalUpdate: (rental: TransferRental) => void;
  onRentalDelete: (oldRental: TransferRental) => void;
}

export function subscribeToRentalRealtime(
  tripId: string,
  callbacks: RentalRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  const uid = Math.random().toString(36).slice(2, 8);
  return supabase
    .channel(`transfer-rentals:${tripId}:${uid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transfer_rentals', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onRentalInsert(payload.new as unknown as TransferRental),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'transfer_rentals', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onRentalUpdate(payload.new as unknown as TransferRental),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'transfer_rentals', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onRentalDelete(payload.old as unknown as TransferRental),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromRentalRealtime(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
