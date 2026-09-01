import { describe, it, expect } from 'vitest';
import { resolveAuthedJoinRedirect } from './resolveAuthedJoinRedirect';

describe('resolveAuthedJoinRedirect', () => {
  it('routes to join-confirm when on the join screen with a token', () => {
    expect(resolveAuthedJoinRedirect(['(auth)', 'join'], 'tok-1')).toEqual({
      pathname: '/trip/join-confirm',
      params: { token: 'tok-1' },
    });
  });

  it('unwraps a token passed as a single-element array (expo-router search params)', () => {
    expect(resolveAuthedJoinRedirect(['(auth)', 'join'], ['tok-1'])).toEqual({
      pathname: '/trip/join-confirm',
      params: { token: 'tok-1' },
    });
  });

  it('falls back to tabs when on the join screen with no token', () => {
    expect(resolveAuthedJoinRedirect(['(auth)', 'join'], undefined)).toEqual({ pathname: '/(tabs)' });
  });

  it('falls back to tabs on any other (auth) screen, even if a token param is present', () => {
    expect(resolveAuthedJoinRedirect(['(auth)', 'login'], 'tok-1')).toEqual({ pathname: '/(tabs)' });
  });

  it('falls back to tabs when segments has no second entry', () => {
    expect(resolveAuthedJoinRedirect(['(auth)'], 'tok-1')).toEqual({ pathname: '/(tabs)' });
  });

  // The exact bug fixed in v1.32.1: a warm-start deep link re-lands on `/join`
  // with a token that was already routed once before (handledInviteTokenRef
  // already holds it). This must still redirect to join-confirm — a caller
  // that skips calling this function when the token looks "already handled"
  // is the regression, not this function returning a redirect for it.
  it('routes to join-confirm again for a token seen in an earlier call (no dedup here)', () => {
    const first = resolveAuthedJoinRedirect(['(auth)', 'join'], 'tok-1');
    const second = resolveAuthedJoinRedirect(['(auth)', 'join'], 'tok-1');
    expect(first).toEqual({ pathname: '/trip/join-confirm', params: { token: 'tok-1' } });
    expect(second).toEqual({ pathname: '/trip/join-confirm', params: { token: 'tok-1' } });
  });
});
