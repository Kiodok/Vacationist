import { supabase, freshChannel } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  TransferPublicTransport,
  CreateTransferPublicTransportInput,
  UpdateTransferPublicTransportInput,
} from '@vacationist/types';

export async function getTransferPublicTransport(tripId: string): Promise<TransferPublicTransport[]> {
  const { data, error } = await supabase
    .from('transfer_public_transport')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('departure_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as TransferPublicTransport[];
}

export async function createTransferPublicTransport(tripId: string, input: CreateTransferPublicTransportInput): Promise<TransferPublicTransport> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const user = session.user;

  const { data, error } = await supabase
    .from('transfer_public_transport')
    .insert({
      trip_id: tripId,
      title: input.title,
      company: input.company ?? null,
      departure_location: input.departure_location ?? null,
      arrival_location: input.arrival_location ?? null,
      departure_time: input.departure_time ?? null,
      arrival_time: input.arrival_time ?? null,
      booking_reference: input.booking_reference ?? null,
      price_total: input.price_total ?? null,
      external_url: input.external_url ?? null,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferPublicTransport;
}

export async function updateTransferPublicTransport(publicTransportId: string, input: UpdateTransferPublicTransportInput): Promise<TransferPublicTransport> {
  const { data, error } = await supabase
    .from('transfer_public_transport')
    .update(input)
    .eq('id', publicTransportId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferPublicTransport;
}

export async function softDeleteTransferPublicTransport(publicTransportId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_transfer_public_transport', { p_id: publicTransportId });
  if (error) throw error;
}

export interface PublicTransportRealtimeCallbacks {
  onPublicTransportInsert: (entry: TransferPublicTransport) => void;
  onPublicTransportUpdate: (entry: TransferPublicTransport) => void;
  onPublicTransportDelete: (oldEntry: TransferPublicTransport) => void;
}

export function subscribeToPublicTransportRealtime(
  tripId: string,
  callbacks: PublicTransportRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  return freshChannel(`transfer-public-transport:${tripId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transfer_public_transport', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onPublicTransportInsert(payload.new as unknown as TransferPublicTransport),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'transfer_public_transport', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onPublicTransportUpdate(payload.new as unknown as TransferPublicTransport),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'transfer_public_transport', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onPublicTransportDelete(payload.old as unknown as TransferPublicTransport),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromPublicTransportRealtime(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
