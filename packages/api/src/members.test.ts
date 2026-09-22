import { describe, it, expect, vi, beforeEach } from 'vitest';

// v1.39.0 round 3: `getCurrentMemberRole` used to swallow ANY error (including a genuine network
// failure) into a trusted `null`, which overwrote the correctly-prefetched role in the cache while
// offline and hid every organizer/participant-gated control app-wide. It must now only resolve
// `null` for a confirmed "not a member" (PGRST116) AND a session that looks like it was actually
// valid when the request went out — anything else should throw so TanStack Query keeps the cache.
const state = vi.hoisted(() => ({
  error: null as { code: string; message: string } | null,
  role: 'organizer' as string | null,
  sessionValid: true,
}));

vi.mock('./client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () =>
              state.error
                ? { data: null, error: state.error }
                : { data: { role: state.role }, error: null },
          }),
        }),
      }),
    }),
  },
}));

vi.mock('./session', () => ({
  getUserIdOfflineSafe: async () => 'me',
  looksSessionValid: async () => state.sessionValid,
}));

import { getCurrentMemberRole } from './members';

beforeEach(() => {
  state.error = null;
  state.role = 'organizer';
  state.sessionValid = true;
});

describe('getCurrentMemberRole', () => {
  it('returns the role on a normal successful read', async () => {
    state.role = 'participant';
    expect(await getCurrentMemberRole('trip-1')).toBe('participant');
  });

  it('returns null for a genuine "not a member" (PGRST116) when the session looks valid', async () => {
    state.error = { code: 'PGRST116', message: 'no rows' };
    state.sessionValid = true;
    expect(await getCurrentMemberRole('trip-1')).toBeNull();
  });

  it('throws (does not resolve null) for PGRST116 when the session does NOT look valid', async () => {
    // The anon-key-fallback case: an expired token made supabase-js retry unauthenticated, and RLS
    // returned the identical 0-row shape as a genuine "not a member" — must not be trusted.
    state.error = { code: 'PGRST116', message: 'no rows' };
    state.sessionValid = false;
    await expect(getCurrentMemberRole('trip-1')).rejects.toEqual(state.error);
  });

  it('throws on any other error, regardless of session validity', async () => {
    state.error = { code: '500', message: 'server error' };
    state.sessionValid = true;
    await expect(getCurrentMemberRole('trip-1')).rejects.toEqual(state.error);
  });
});
