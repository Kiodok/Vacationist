import { describe, it, expect, vi, beforeEach } from 'vitest';

// session.ts imports the real `./client` (react-native / expo). Mock it so the
// node test env can load the module; provide a controllable getSession + a
// fake SecureStore adapter.
const state = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  getSessionThrows: false,
  stored: null as string | null,
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
    getItem: async () => state.stored,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

import { readStoredSession, getUserIdOfflineSafe, NotAuthenticatedError } from './session';

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
