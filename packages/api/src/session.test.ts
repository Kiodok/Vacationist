import { describe, it, expect, vi, beforeEach } from 'vitest';

// session.ts imports the real `./client` (react-native / expo). Mock it so the
// node test env can load the module; provide a controllable getSession + a
// fake SecureStore adapter.
const state = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  getSessionThrows: false,
  stored: null as string | null,
  /** null value read + this true = "storage was unreadable" (locked Keychain) */
  readFailed: false,
}));

vi.mock('./client', () => ({
  AUTH_STORAGE_KEY: 'sb-test-auth-token',
  supabase: {
    auth: {
      getSession: async () => {
        if (state.getSessionThrows) throw new Error('network');
        return { data: { session: state.session } };
      },
    },
  },
  ExpoSecureStoreAdapter: {
    // Mirrors the hardened adapter: never throws, serves the last-known value.
    getItem: async () => state.stored,
    setItem: async () => {},
    removeItem: async () => {},
  },
  lastSecureReadFailed: () => state.readFailed,
}));

import {
  readStoredSession,
  readStoredSessionResult,
  getUserIdOfflineSafe,
  NotAuthenticatedError,
} from './session';

const STORED_BLOB = JSON.stringify({
  access_token: 'at',
  refresh_token: 'rt',
  expires_at: 1_900_000_000,
  user: { id: 'stored-user', is_anonymous: false },
});

beforeEach(() => {
  state.session = null;
  state.getSessionThrows = false;
  state.stored = null;
  state.readFailed = false;
});

describe('readStoredSession', () => {
  it('parses a valid persisted session blob', async () => {
    state.stored = STORED_BLOB;
    const s = await readStoredSession();
    expect(s).toEqual({
      userId: 'stored-user',
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: 1_900_000_000,
      isAnonymous: false,
    });
  });

  it('returns null for a missing key', async () => {
    state.stored = null;
    expect(await readStoredSession()).toBeNull();
  });

  it('returns null for corrupt JSON', async () => {
    state.stored = '{not json';
    expect(await readStoredSession()).toBeNull();
  });

  it('returns null when the blob lacks tokens or a user id', async () => {
    state.stored = JSON.stringify({ access_token: 'at' });
    expect(await readStoredSession()).toBeNull();
  });
});

describe('readStoredSessionResult', () => {
  it('reports storageUnavailable when the read failed and there is no value', async () => {
    state.stored = null;
    state.readFailed = true;
    const res = await readStoredSessionResult();
    expect(res.session).toBeNull();
    expect(res.storageUnavailable).toBe(true);
    // The thin wrapper still just returns the (null) session.
    expect(await readStoredSession()).toBeNull();
  });

  it('does NOT report storageUnavailable when the key is genuinely absent', async () => {
    state.stored = null;
    state.readFailed = false;
    const res = await readStoredSessionResult();
    expect(res).toEqual({ session: null, storageUnavailable: false });
  });

  it('never reports storageUnavailable once a session was parsed', async () => {
    state.stored = STORED_BLOB;
    state.readFailed = true; // stale flag — a value came back, so it is moot
    const res = await readStoredSessionResult();
    expect(res.session?.userId).toBe('stored-user');
    expect(res.storageUnavailable).toBe(false);
  });
});

describe('getUserIdOfflineSafe', () => {
  it('prefers the live session', async () => {
    state.session = { user: { id: 'live-user' } };
    state.stored = STORED_BLOB;
    expect(await getUserIdOfflineSafe()).toBe('live-user');
  });

  it('falls back to the stored session when getSession returns null (offline + expired)', async () => {
    state.session = null;
    state.stored = STORED_BLOB;
    expect(await getUserIdOfflineSafe()).toBe('stored-user');
  });

  it('falls back to the stored session when getSession throws', async () => {
    state.getSessionThrows = true;
    state.stored = STORED_BLOB;
    expect(await getUserIdOfflineSafe()).toBe('stored-user');
  });

  it('throws NotAuthenticatedError when there is nothing anywhere', async () => {
    state.session = null;
    state.stored = null;
    await expect(getUserIdOfflineSafe()).rejects.toBeInstanceOf(NotAuthenticatedError);
  });
});
