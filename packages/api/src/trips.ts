import { supabase } from './client';
import type { Trip, CreateTripInput, UpdateTripInput } from '@vacationist/types';

interface TripRow {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  budget_per_person: number | null;
  base_currency: string;
  timezone: string;
  status: string;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
  trip_members: { count: number }[];
}

function toTripWithCount(row: TripRow): Trip & { member_count: number } {
  const { trip_members, ...tripFields } = row;
  return {
    ...tripFields,
    member_count: trip_members?.[0]?.count ?? 0,
  } as Trip & { member_count: number };
}

export async function getTrips(): Promise<(Trip & { member_count: number })[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_members(count)')
    .order('start_date', { ascending: false });

  if (error) throw error;
  return (data as unknown as TripRow[]).map(toTripWithCount);
}

export async function getTrip(tripId: string): Promise<Trip & { member_count: number }> {
  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_members(count)')
    .eq('id', tripId)
    .single();

  if (error) throw error;
  return toTripWithCount(data as unknown as TripRow);
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

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
  const { error } = await supabase
    .from('trips')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', tripId);

  if (error) throw error;
}
