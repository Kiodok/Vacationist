import { supabase } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  TransferFlight,
  TransferFlightVote,
  TransferFlightPassenger,
  VoteType,
  CreateTransferFlightInput,
  UpdateTransferFlightInput,
  BookTransferFlightInput,
} from '@vacationist/types';

export async function getTransferFlights(tripId: string): Promise<TransferFlight[]> {
  const { data, error } = await supabase
    .from('transfer_flights')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('direction', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as TransferFlight[];
}

export async function getTransferFlight(flightId: string): Promise<TransferFlight> {
  const { data, error } = await supabase
    .from('transfer_flights')
    .select('*')
    .eq('id', flightId)
    .single();

  if (error) throw error;
  return data as unknown as TransferFlight;
}

export async function createTransferFlight(tripId: string, input: CreateTransferFlightInput): Promise<TransferFlight> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('transfer_flights')
    .insert({
      trip_id: tripId,
      title: input.title,
      description: input.description ?? null,
      direction: input.direction,
      airline: input.airline ?? null,
      departure_airport: input.departure_airport ?? null,
      arrival_airport: input.arrival_airport ?? null,
      departure_time: input.departure_time ?? null,
      arrival_time: input.arrival_time ?? null,
      return_departure_airport: input.return_departure_airport ?? null,
      return_arrival_airport: input.return_arrival_airport ?? null,
      return_departure_time: input.return_departure_time ?? null,
      return_arrival_time: input.return_arrival_time ?? null,
      price_per_person: input.price_per_person ?? null,
      external_url: input.external_url ?? null,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferFlight;
}

export async function updateTransferFlight(flightId: string, input: UpdateTransferFlightInput): Promise<TransferFlight> {
  const { data, error } = await supabase
    .from('transfer_flights')
    .update(input)
    .eq('id', flightId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferFlight;
}

export async function softDeleteTransferFlight(flightId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_transfer_flight', { p_flight_id: flightId });
  if (error) throw error;
}

export async function closeTransferFlightVoting(flightId: string): Promise<void> {
  const { error } = await supabase.rpc('close_transfer_flight_voting', { p_flight_id: flightId });
  if (error) throw error;
}

export async function reopenTransferFlightVoting(flightId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_transfer_flight_voting', { p_flight_id: flightId });
  if (error) throw error;
}

export async function bookTransferFlight(flightId: string, input: BookTransferFlightInput): Promise<void> {
  const { error } = await supabase.rpc('book_transfer_flight', {
    p_flight_id: flightId,
    p_flight_number: input.flight_number ?? undefined,
    p_booking_reference: input.booking_reference ?? undefined,
  });
  if (error) throw error;
}

export async function getTransferFlightVotes(flightId: string): Promise<TransferFlightVote[]> {
  const { data, error } = await supabase
    .from('transfer_flight_votes')
    .select('*')
    .eq('flight_id', flightId);

  if (error) throw error;
  return data as unknown as TransferFlightVote[];
}

export async function getTransferFlightVotesBatch(flightIds: string[]): Promise<TransferFlightVote[]> {
  if (flightIds.length === 0) return [];

  const { data, error } = await supabase
    .from('transfer_flight_votes')
    .select('*')
    .in('flight_id', flightIds);

  if (error) throw error;
  return data as unknown as TransferFlightVote[];
}

export async function castTransferFlightVote(flightId: string, vote: VoteType): Promise<TransferFlightVote> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('transfer_flight_votes')
    .upsert(
      { flight_id: flightId, user_id: user.id, vote },
      { onConflict: 'flight_id,user_id' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as TransferFlightVote;
}

export async function removeTransferFlightVote(flightId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('transfer_flight_votes')
    .delete()
    .eq('flight_id', flightId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function getTransferFlightPassengers(flightId: string): Promise<TransferFlightPassenger[]> {
  const { data, error } = await supabase
    .from('transfer_flight_passengers')
    .select('*')
    .eq('flight_id', flightId);

  if (error) throw error;
  return data as unknown as TransferFlightPassenger[];
}

export async function setTransferFlightPassengers(flightId: string, userIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_transfer_flight_passengers', {
    p_flight_id: flightId,
    p_user_ids: userIds,
  });
  if (error) throw error;
}

export interface FlightVotingRealtimeCallbacks {
  onFlightInsert: (flight: TransferFlight) => void;
  onFlightUpdate: (flight: TransferFlight) => void;
  onVoteInsert: (vote: TransferFlightVote) => void;
  onVoteUpdate: (vote: TransferFlightVote) => void;
  onVoteDelete: (oldVote: TransferFlightVote) => void;
  onPassengerInsert: (passenger: TransferFlightPassenger) => void;
  onPassengerDelete: (oldPassenger: TransferFlightPassenger) => void;
}

export function subscribeToFlightVotingRealtime(
  tripId: string,
  callbacks: FlightVotingRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  const uid = Math.random().toString(36).slice(2, 8);
  return supabase
    .channel(`transfer-flights:${tripId}:${uid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transfer_flights', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onFlightInsert(payload.new as unknown as TransferFlight),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'transfer_flights', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onFlightUpdate(payload.new as unknown as TransferFlight),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transfer_flight_votes', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVoteInsert(payload.new as unknown as TransferFlightVote),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'transfer_flight_votes', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVoteUpdate(payload.new as unknown as TransferFlightVote),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'transfer_flight_votes', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVoteDelete(payload.old as unknown as TransferFlightVote),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'transfer_flight_passengers', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onPassengerInsert(payload.new as unknown as TransferFlightPassenger),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'transfer_flight_passengers', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onPassengerDelete(payload.old as unknown as TransferFlightPassenger),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromFlightVoting(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
