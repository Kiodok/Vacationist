import { supabase, AUTH_STORAGE_KEY, ExpoSecureStoreAdapter } from './client';

/**
 * Offline-safe session access (Phase 19).
 *
 * `supabase.auth.getSession()` is NOT a pure storage read: when the access token
 * is past (or within ~90s of) expiry it triggers a `/token` refresh, which fails
 * offline and returns `{ session: null, error }`. Every consumer that treated
 * that as "signed out" is why the app used to bounce a perfectly-authenticated
 * user to the (network-only) login screen an hour into a flight.
 *
 * These helpers read the persisted session straight out of storage — the same
 * blob auth-js wrote — with no network call, so the app can keep trusting a
 * still-valid refresh token while offline. auth-js keeps that blob in storage on
 * a retryable (network) refresh failure, and the auto-refresh ticker heals the
 * live client the moment connectivity returns.
 */

export interface StoredSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
  /** epoch seconds, matching auth-js `expires_at` */
  expiresAt: number | null;
  isAnonymous: boolean;
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super('Not authenticated');
    this.name = 'NotAuthenticatedError';
  }
}

/** Reads and parses the persisted auth session. No network, no refresh. */
export async function readStoredSession(): Promise<StoredSession | null> {
  let raw: string | null;
  try {
    raw = await ExpoSecureStoreAdapter.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number | null;
      user?: { id?: string; is_anonymous?: boolean };
    };
    if (!parsed.access_token || !parsed.refresh_token || !parsed.user?.id) {
      return null;
    }
    return {
      userId: parsed.user.id,
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token,
      expiresAt: parsed.expires_at ?? null,
      isAnonymous: parsed.user.is_anonymous ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * The current user's id, preferring the live client but falling back to the
 * stored session when `getSession()` comes back empty (expired token + offline).
 *
 * Use this in every `packages/api` write helper instead of
 * `if (!session?.user) throw new Error('Not authenticated')`. When the caller is
 * genuinely offline the subsequent `.insert()` / `.rpc()` still fails with a
 * real network error, which TanStack Query pauses into the offline queue — the
 * old pattern threw a *non-network* error that defeated that queue.
 */
export async function getUserIdOfflineSafe(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) return data.session.user.id;
  } catch {
    // fall through to the stored-session read
  }
  const stored = await readStoredSession();
  if (stored) return stored.userId;
  throw new NotAuthenticatedError();
}

/** True when a persisted session exists on disk, regardless of token freshness. */
export async function hasStoredSession(): Promise<boolean> {
  return (await readStoredSession()) !== null;
}
