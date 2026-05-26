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
