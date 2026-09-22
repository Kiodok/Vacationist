import { supabase } from './client';
import { getUserIdOfflineSafe, looksSessionValid, trustEmptyList } from './session';
import type { TripMember, User, MemberRole } from '@vacationist/types';

export type TripMemberWithUser = TripMember & { user: User };

export async function getTripMembers(tripId: string): Promise<TripMemberWithUser[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('*, user:users(*)')
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true });

  // Never legitimately empty — RLS requires the caller to already be a member to read this at
  // all, so a 0-row result is always suspicious, never a real "this trip has no members" state.
  if (error) throw error;
  return trustEmptyList(data as unknown as TripMemberWithUser[]);
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
  const user = { id: await getUserIdOfflineSafe() };

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
  let userId: string;
  try {
    userId = await getUserIdOfflineSafe();
  } catch {
    return null;
  }
  const user = { id: userId };

  const { data, error } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    // PGRST116 (0 rows) genuinely means "not a member of this trip" — but ONLY when the request
    // plausibly carried a valid token. An expired token + a failed refresh (offline) makes
    // supabase-js silently retry on the anon key, which RLS also turns into "0 rows" — a false
    // negative that used to overwrite (and, within 4s, persist over) a correctly-prefetched
    // 'organizer'/'participant' role, hiding every role-gated control app-wide while offline
    // (v1.39.0 round 3, 22.09 test session). Throwing instead lets TanStack Query keep the
    // cached role rather than clobbering it with this untrustworthy null.
    if (error.code === 'PGRST116' && (await looksSessionValid())) return null;
    throw error;
  }
  return data.role as MemberRole;
}
