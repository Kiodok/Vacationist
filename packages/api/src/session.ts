import {
  supabase,
  AUTH_STORAGE_KEY,
  ExpoSecureStoreAdapter,
  lastSecureReadFailed,
} from './client';

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

function parseStoredSession(raw: string | null): StoredSession | null {
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

export interface StoredSessionResult {
  session: StoredSession | null;
  /**
   * True when the storage read itself failed (locked Keychain, Keystore fault)
   * rather than there genuinely being no session on disk. Callers must NOT treat
   * this as "signed out" — the credentials are still there, just unreadable right
   * now. See Sentry REACT-NATIVE-M / the storage adapter.
   */
  storageUnavailable: boolean;
}

/**
 * Reads and parses the persisted auth session, distinguishing "no session on
 * disk" from "storage was unreadable". No network, no refresh.
 */
export async function readStoredSessionResult(): Promise<StoredSessionResult> {
  let raw: string | null = null;
  try {
    raw = await ExpoSecureStoreAdapter.getItem(AUTH_STORAGE_KEY);
  } catch {
    // The hardened adapter shouldn't throw, but be defensive.
    return { session: null, storageUnavailable: true };
  }
  const session = parseStoredSession(raw);
  const storageUnavailable = session === null && lastSecureReadFailed(AUTH_STORAGE_KEY);
  return { session, storageUnavailable };
}

/** Reads and parses the persisted auth session. No network, no refresh. */
export async function readStoredSession(): Promise<StoredSession | null> {
  return (await readStoredSessionResult()).session;
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

/**
 * Does the stored session's access token look like it's still valid right now?
 *
 * supabase-js silently falls back to the ANON key when `getSession()`/its token refresh fails
 * (typically: expired token + a flaky reconnect) — against RLS that produces a legitimate-LOOKING
 * empty or not-found result, no thrown error. A read function that trusts such a result as ground
 * truth ends up caching (and, offline, persisting) a false negative over real data.
 *
 * `false` here means a request just made with the stored credentials may actually have gone out
 * unauthenticated — an empty/null/not-found result it returned should NOT be trusted; the caller
 * should throw instead, so TanStack Query preserves whatever is already cached. `true` means the
 * token should have been valid, so a genuinely-empty result is genuinely empty.
 *
 * No network call — reads the same on-disk blob as `readStoredSession()`.
 */
export async function looksSessionValid(): Promise<boolean> {
  const stored = await readStoredSession();
  return !!stored && stored.expiresAt != null && stored.expiresAt * 1000 > Date.now();
}

/**
 * Guards a plain list `.select()` result. Unlike `.single()`, an RLS-filtered list read returns an
 * empty array with NO error at all — a function that just `return`s it is trusting an anon-key
 * fallback's silently-empty result exactly like the old `getCurrentMemberRole` bug did, just without
 * an `error` to catch. A non-empty result is always trusted (an anon-key request can only ever be
 * filtered DOWN by RLS, never fabricate rows); an empty one is trusted only when the session looks
 * like it was actually valid.
 *
 * Call as `return trustEmptyList(data as Foo[]);` at the end of any trip/user-scoped list read.
 */
export async function trustEmptyList<T>(rows: T[]): Promise<T[]> {
  if (rows.length > 0 || (await looksSessionValid())) return rows;
  throw new Error('Empty result while session validity is unverified (likely an offline anon-key fallback)');
}

/** Same guard as `trustEmptyList`, for a single-row read that resolves `null` on "not found"
 * (`.maybeSingle()`, or an RPC that returns zero rows) instead of an array. */
export async function trustNullResult<T>(value: T | null): Promise<T | null> {
  if (value !== null || (await looksSessionValid())) return value;
  throw new Error('Null result while session validity is unverified (likely an offline anon-key fallback)');
}
