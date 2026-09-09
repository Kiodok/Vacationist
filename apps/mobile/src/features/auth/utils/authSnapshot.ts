import * as SecureStore from 'expo-secure-store';
import { readStoredSessionResult, SECURE_STORE_OPTIONS } from '@vacationist/api';

/**
 * Offline session-trust window (Phase 19).
 *
 * A stored refresh token is valid on the server for as long as it isn't
 * revoked, so a device that's been offline for a week still holds working
 * credentials. We deliberately *don't* trust that indefinitely: this snapshot
 * records when we last had a live server confirmation, and the app stays
 * usable offline for {@link OFFLINE_TRUST_WINDOW_MS} past that point. Beyond it,
 * `<OfflineReauthGate>` asks for a biometric / device-PIN confirmation to
 * extend another window — never a hard dead-end while there's no network.
 *
 * Stored in SecureStore (not MMKV): the payload is tiny and keeping it next to
 * the Keychain-backed session makes it a little harder to tamper with the
 * "last verified" timestamp on a lost device.
 */

const KEY = 'offline_auth_snapshot_v1';

export const OFFLINE_TRUST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface AuthSnapshot {
  userId: string;
  /** epoch ms of the last live server confirmation of this session */
  lastVerifiedAt: number;
  /** epoch ms until which a biometric re-auth has extended offline trust */
  offlineExtendedUntil?: number;
}

export type OfflineWindowState = 'valid' | 'needs-extend' | 'no-credentials';

async function read(): Promise<AuthSnapshot | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSnapshot;
    if (!parsed.userId || typeof parsed.lastVerifiedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function write(snap: AuthSnapshot): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(snap), SECURE_STORE_OPTIONS);
  } catch {
    // best-effort — a missing snapshot degrades to `needs-extend`, not a lockout
  }
}

/**
 * Record a live server confirmation of the current session. Call after any
 * successful authenticated round-trip (profile fetch, TOKEN_REFRESHED, SIGNED_IN).
 */
export async function markVerified(userId: string): Promise<void> {
  await write({ userId, lastVerifiedAt: Date.now() });
}

/** Grant another {@link OFFLINE_TRUST_WINDOW_MS} of offline trust after a biometric check. */
export async function extendOfflineWindow(userId: string): Promise<void> {
  const existing = await read();
  await write({
    userId,
    lastVerifiedAt: existing?.lastVerifiedAt ?? Date.now(),
    offlineExtendedUntil: Date.now() + OFFLINE_TRUST_WINDOW_MS,
  });
}

export async function clearAuthSnapshot(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}

/**
 * Where we stand for an offline launch:
 * - `no-credentials` — nothing to trust; show the login screen.
 * - `valid` — inside the 7-day window (or a biometric extension); enter the app.
 * - `needs-extend` — credentials exist but the window lapsed; show OfflineReauthGate.
 */
export async function offlineWindowState(): Promise<OfflineWindowState> {
  const { session: stored, storageUnavailable } = await readStoredSessionResult();
  if (!stored) {
    // A locked/faulted Keychain read is NOT proof the user signed out — the
    // credentials are still on disk. Keep the app open; the auto-refresh ticker
    // and the next foregrounded launch heal it. (Sentry REACT-NATIVE-M.)
    return storageUnavailable ? 'valid' : 'no-credentials';
  }

  const snap = await read();
  const now = Date.now();

  // No snapshot but a real session on disk (e.g. upgraded from a pre-Phase-19
  // build): treat "now" as the baseline rather than locking the user out.
  if (!snap) {
    await markVerified(stored.userId);
    return 'valid';
  }

  if (now - snap.lastVerifiedAt < OFFLINE_TRUST_WINDOW_MS) return 'valid';
  if (snap.offlineExtendedUntil && now < snap.offlineExtendedUntil) return 'valid';
  return 'needs-extend';
}
