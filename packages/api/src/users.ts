import { supabase } from './client';
import type { User, UpdateProfileInput } from '@vacationist/types';
import type { Session } from '@supabase/supabase-js';

export async function getUserProfile(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data as User;
}

export async function ensureUserProfile(session: Session): Promise<User> {
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  // In practice this branch is almost never reached: the on_auth_user_created
  // trigger (20260511000001) already inserts the row server-side before the
  // client gets here. It stays as a defensive fallback in case that trigger
  // is ever removed or a row is somehow missing.
  if (existing) return existing as User;

  const metadata = session.user.user_metadata;
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: session.user.id,
      name: metadata.full_name ?? metadata.name ?? 'User',
      email: session.user.email ?? null,
      avatar_url: metadata.avatar_url ?? metadata.picture ?? null,
      is_guest: session.user.is_anonymous ?? false,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

// Atomically claims "we have not reported this account's sign-up attribution
// before" — returns true exactly once per account, race-safe under Postgres
// row locking even if called concurrently (see useAuthInit.ts, where
// loadSession() and onAuthStateChange can both resolve for the same fresh
// sign-in). Do NOT infer novelty from whether a public.users row exists —
// the on_auth_user_created trigger always creates it first, so that check is
// always true and was the root cause of the Reddit SignUp conversion never
// firing (see 20260808120000_add_signup_attribution_claim.sql).
export async function claimSignupAttribution(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .update({ signup_attribution_claimed_at: new Date().toISOString() })
    .eq('id', userId)
    .is('signup_attribution_claimed_at', null)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function uploadAvatar(
  userId: string,
  fileData: Blob | ArrayBuffer,
  contentType: string = 'image/jpeg',
): Promise<string> {
  // Fixed path (no extension) so every upload overwrites the same object
  // and no stale files accumulate when the format changes between uploads.
  const path = `${userId}/avatar`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, fileData, { contentType, upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function getUsersByIds(userIds: string[]): Promise<User[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .in('id', userIds);
  if (error) throw error;
  return (data ?? []) as User[];
}

export async function updateUserProfile(
  userId: string,
  updates: UpdateProfileInput
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as User;
}
