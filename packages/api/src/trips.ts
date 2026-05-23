import { supabase, freshChannel } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Trip, CreateTripInput, UpdateTripInput } from '@vacationist/types';

export class TripNotFoundError extends Error {
  constructor() {
    super('Trip not found or you do not have access');
    this.name = 'TripNotFoundError';
  }
}

export async function getTrips(): Promise<(Trip & { member_count: number })[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('start_date', { ascending: false });

  if (error) throw error;
  return data as unknown as (Trip & { member_count: number })[];
}

export async function getTrip(tripId: string): Promise<Trip & { member_count: number }> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new TripNotFoundError();
    throw error;
  }
  return data as unknown as Trip & { member_count: number };
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const user = session.user;

  const { data, error } = await supabase
    .from('trips')
    .insert({
      title: input.title,
      description: input.description ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      budget_per_person: input.budget_per_person ?? null,
      base_currency: input.base_currency,
      timezone: input.timezone,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Trip;
}

export async function updateTrip(tripId: string, input: UpdateTripInput): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .update(input)
    .eq('id', tripId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Trip;
}

export async function softDeleteTrip(tripId: string): Promise<void> {
  // Direct UPDATE is blocked by PostgreSQL 16+ implicit SELECT-policy WITH CHECK
  // (setting deleted_at makes the new row invisible, failing trips_select_member).
  // SECURITY DEFINER RPC bypasses RLS and checks organizer auth internally.
  const { error } = await supabase.rpc('soft_delete_trip', { p_trip_id: tripId });
  if (error) throw error;
}

export interface TripRealtimeCallbacks {
  onUpdate: (trip: Trip) => void;
}

export function subscribeToTripRealtime(
  tripId: string,
  callbacks: TripRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  return freshChannel(`trip-details:${tripId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
      (payload) => callbacks.onUpdate(payload.new as unknown as Trip),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromTrip(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
