import { supabase } from './client';

export async function upsertPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  const { error } = await supabase.rpc('upsert_push_token', {
    p_push_token: token,
    p_platform: platform,
  });

  if (error) throw error;
}

export async function deletePushToken(token: string): Promise<void> {
  const { error } = await supabase.rpc('delete_push_token', {
    p_push_token: token,
  });

  if (error) throw error;
}
