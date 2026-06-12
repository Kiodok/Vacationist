import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { ExpoSecureStoreAdapter } from './storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const DEFAULT_TIMEOUT_MS = 15_000;
const STORAGE_TIMEOUT_MS = 60_000; // uploads/downloads need headroom

/**
 * fetch wrapper with a hard timeout. Without it, requests on a flaky
 * connection (connected but no real internet) hang for the OS default (60s+),
 * leaving the UI stuck. An aborted request becomes an error, which flows into
 * TanStack Query's retry → offline-pause path — exactly what we want.
 * Manual AbortController because AbortSignal.timeout/any are unreliable on Hermes.
 */
function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const ms = url.includes('/storage/v1/') ? STORAGE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  init.signal?.addEventListener('abort', () => controller.abort());
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
  global: {
    fetch: fetchWithTimeout,
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
