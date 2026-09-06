import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { ExpoSecureStoreAdapter } from './storage';

// Re-exported so `session.ts` can read the persisted auth blob without importing
// `./storage` directly — tests mock `./client` wholesale, and a direct
// `./storage` import would drag `react-native` into the node test environment.
export { ExpoSecureStoreAdapter };

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

/**
 * The exact SecureStore/localStorage key auth-js uses for the persisted session.
 * auth-js derives this from the Supabase URL host as `sb-<ref>-auth-token` when
 * no explicit `storageKey` is set — we replicate that derivation (rather than
 * setting an explicit key, which would orphan every already-installed user's
 * session on update) so `session.ts` can read the stored session straight out
 * of storage offline, without the network round-trip `getSession()` does when
 * the access token is expired (see Phase 19 / offline-session-durability skill).
 */
export const AUTH_STORAGE_KEY = (() => {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return 'sb-auth-token';
  }
})();

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
 * Force the realtime socket to reconnect. Call on an offline→online transition:
 * Supabase's socket does eventually retry on its own, but only after its own
 * backoff, and a device that regains signal with the app already foregrounded
 * can otherwise sit on a dead socket for a long time (Phase 19). Existing
 * channels rejoin automatically once the socket is back up.
 */
export function reconnectRealtime(): void {
  try {
    supabase.realtime.disconnect();
    supabase.realtime.connect();
  } catch {
    // realtime not initialised / already connecting — nothing to do
  }
}

/**
 * Best-effort proactive token refresh. Call when connectivity returns so the
 * access token is as fresh as possible before the next disconnect, and so the
 * offline trust window's "last verified" timestamp advances (via the
 * TOKEN_REFRESHED → onAuthStateChange path). Swallows all errors.
 */
export async function refreshSessionQuietly(): Promise<void> {
  try {
    await supabase.auth.refreshSession();
  } catch {
    // offline again already, or nothing to refresh
  }
}

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
