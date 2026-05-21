import { supabase } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PreworkPreferences, UpsertPreworkPreferencesInput } from '@vacationist/types';

export async function getPreworkPreferences(tripId: string): Promise<PreworkPreferences[]> {
  const { data, error } = await supabase
    .from('prework_preferences')
    .select('*')
    .eq('trip_id', tripId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data as unknown as PreworkPreferences[];
}

export async function getMyPreworkPreferences(tripId: string): Promise<PreworkPreferences | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('prework_preferences')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as PreworkPreferences | null;
}

export async function upsertPreworkPreferences(
  tripId: string,
  input: UpsertPreworkPreferencesInput
): Promise<PreworkPreferences> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('prework_preferences')
    .upsert(
      {
        trip_id: tripId,
        user_id: user.id,
        filters: input.filters,
      },
      { onConflict: 'trip_id,user_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as PreworkPreferences;
}

export async function deletePreworkPreferences(tripId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('prework_preferences')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export interface PreworkRealtimeCallbacks {
  onInsert: (pref: PreworkPreferences) => void;
  onUpdate: (pref: PreworkPreferences) => void;
  onDelete: (oldPref: { id: string; trip_id?: string; user_id?: string }) => void;
}

export function subscribeToPreworkRealtime(
  tripId: string,
  callbacks: PreworkRealtimeCallbacks,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  const uid = Math.random().toString(36).slice(2, 8);
  return supabase
    .channel(`prework:${tripId}:${uid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'prework_preferences', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onInsert(payload.new as unknown as PreworkPreferences),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'prework_preferences', filter: `trip_id=eq.${tripId}` },
      (payload) => callbacks.onUpdate(payload.new as unknown as PreworkPreferences),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'prework_preferences' },
      (payload) => callbacks.onDelete(payload.old as { id: string; trip_id?: string; user_id?: string }),
    )
    .subscribe((status) => onStatus?.(status));
}

export function unsubscribeFromPrework(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
