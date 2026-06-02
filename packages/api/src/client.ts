import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { ExpoSecureStoreAdapter } from './storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});

/**
 * Returns a fresh Supabase realtime channel, evicting any stale channel with
 * the same name that is still in the client registry.
 *
 * supabase.channel(name) deduplicates by topic: if a previous channel with the
 * same name was not fully removed yet (removeChannel is async), it returns the
 * already-subscribed instance. Calling .on('postgres_changes') on a subscribed
 * channel throws. This helper synchronously removes the stale entry before
 * creating the new channel so every subscriber starts clean.
 */
export function freshChannel(name: string) {
  const topic = `realtime:${name}`;
  const channels = supabase.getChannels();
  const staleIdx = channels.findIndex((c) => c.topic === topic);
  if (staleIdx >= 0) {
    const stale = channels[staleIdx];
    channels.splice(staleIdx, 1);
    stale.unsubscribe().catch(() => {});
  }
  return supabase.channel(name);
}
