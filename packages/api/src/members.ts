import { supabase } from './client';
import type { TripMember, User, MemberRole } from '@vacationist/types';

export type TripMemberWithUser = TripMember & { user: User };

export async function getTripMembers(tripId: string): Promise<TripMemberWithUser[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('*, user:users(*)')
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data as unknown as TripMemberWithUser[];
}

export async function removeTripMember(tripId: string, userId: string): Promise<void> {
  // .select('id') is required: without it Supabase returns { data: null, error: null }
  // even when RLS blocks the DELETE, making it impossible to detect 0-row deletions.
  const { data, error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Permission denied or member not found');
  }
}

export async function leaveTrip(tripId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const user = session.user;

  const { data, error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('You are not a member of this trip');
  }
}

export async function updateMemberRole(
  tripId: string,
  userId: string,
  role: MemberRole
): Promise<void> {
  const { error } = await supabase
    .from('trip_members')
    .update({ role })
    .eq('trip_id', tripId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function getCurrentMemberRole(tripId: string): Promise<MemberRole | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const user = session.user;

  const { data, error } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data.role as MemberRole;
}
