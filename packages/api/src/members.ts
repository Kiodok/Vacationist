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
  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);

  if (error) throw error;
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data.role as MemberRole;
}
