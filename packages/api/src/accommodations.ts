import { supabase } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Accommodation, AccommodationVote, VoteType, CreateAccommodationInput, UpdateAccommodationInput } from '@vacationist/types';

export async function getAccommodations(tripId: string): Promise<Accommodation[]> {
  const { data, error } = await supabase
    .from('accommodations')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as Accommodation[];
}

export async function getAccommodation(accommodationId: string): Promise<Accommodation> {
  const { data, error } = await supabase
    .from('accommodations')
    .select('*')
    .eq('id', accommodationId)
    .single();

  if (error) throw error;
  return data as unknown as Accommodation;
}

export async function createAccommodation(tripId: string, input: CreateAccommodationInput): Promise<Accommodation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('accommodations')
    .insert({
      trip_id: tripId,
      title: input.title,
      description: input.description ?? null,
      price_total: input.price_total ?? null,
      external_url: input.external_url ?? null,
      notes: input.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Accommodation;
}

export async function updateAccommodation(accommodationId: string, input: UpdateAccommodationInput): Promise<Accommodation> {
  const { data, error } = await supabase
    .from('accommodations')
    .update(input)
    .eq('id', accommodationId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Accommodation;
}

export async function softDeleteAccommodation(accommodationId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_accommodation', { p_accommodation_id: accommodationId });
  if (error) throw error;
}

export async function closeAccommodationVoting(accommodationId: string): Promise<void> {
  const { error } = await supabase.rpc('close_accommodation_voting', { p_accommodation_id: accommodationId });
  if (error) throw error;
}

export async function reopenAccommodationVoting(accommodationId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_accommodation_voting', { p_accommodation_id: accommodationId });
  if (error) throw error;
}

export async function getAccommodationVotes(accommodationId: string): Promise<AccommodationVote[]> {
  const { data, error } = await supabase
    .from('accommodation_votes')
    .select('*')
    .eq('accommodation_id', accommodationId);

  if (error) throw error;
  return data as unknown as AccommodationVote[];
}

export async function castAccommodationVote(accommodationId: string, vote: VoteType): Promise<AccommodationVote> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('accommodation_votes')
    .upsert(
      { accommodation_id: accommodationId, user_id: user.id, vote },
      { onConflict: 'accommodation_id,user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as AccommodationVote;
}

export async function removeAccommodationVote(accommodationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('accommodation_votes')
    .delete()
    .eq('accommodation_id', accommodationId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export interface AccommodationVotingRealtimeCallbacks {
  onVoteInsert: (vote: AccommodationVote) => void;
  onVoteUpdate: (vote: AccommodationVote) => void;
  onVoteDelete: (oldVote: AccommodationVote) => void;
  onAccommodationUpdate: (accommodation: Accommodation) => void;
}

export function subscribeToAccommodationVotingRealtime(
  tripId: string,
  callbacks: AccommodationVotingRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  const uid = Math.random().toString(36).slice(2, 8);
  return supabase
    .channel(`accommodation-voting:${tripId}:${uid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'accommodation_votes', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVoteInsert(payload.new as unknown as AccommodationVote),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'accommodation_votes', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVoteUpdate(payload.new as unknown as AccommodationVote),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'accommodation_votes', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onVoteDelete(payload.old as unknown as AccommodationVote),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'accommodations', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onAccommodationUpdate(payload.new as unknown as Accommodation),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromAccommodationVoting(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
