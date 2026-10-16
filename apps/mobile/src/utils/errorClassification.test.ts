import { describe, it, expect } from 'vitest';
import { isExpectedMutationError, isAuthError, isNetworkError } from './errorClassification';

describe('isExpectedMutationError', () => {
  it('treats a bare RAISE EXCEPTION (P0001) as expected', () => {
    expect(
      isExpectedMutationError({ code: 'P0001', message: 'Split not found', details: null, hint: null }),
    ).toBe(true);
    expect(
      isExpectedMutationError({ code: 'P0001', message: 'Guests cannot archive expenses', details: null, hint: null }),
    ).toBe(true);
  });

  it('treats an RLS denial (42501) as expected', () => {
    expect(isExpectedMutationError({ code: '42501', message: 'permission denied for table expenses' })).toBe(true);
  });

  it('treats any PostgREST error code as expected', () => {
    expect(isExpectedMutationError({ code: 'PGRST116', message: 'Results contain 0 rows' })).toBe(true);
    expect(isExpectedMutationError({ code: 'PGRST301', message: 'JWT expired' })).toBe(true);
  });

  it('treats a unique violation as expected', () => {
    expect(isExpectedMutationError({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(true);
  });

  it('matches known business-rule message fragments on DB-shaped errors', () => {
    expect(
      isExpectedMutationError({ code: 'P0001', message: 'Not a trip member', details: null, hint: null }),
    ).toBe(true);
    expect(
      isExpectedMutationError({ message: 'Rate limit exceeded', details: null, hint: null }),
    ).toBe(true);
  });

  it('does NOT suppress a genuine JS error even if its message contains a fragment', () => {
    expect(isExpectedMutationError(new TypeError("Cannot read properties of undefined (reading 'not found')"))).toBe(false);
    const err = new Error('user record not found in cache');
    expect(isExpectedMutationError(err)).toBe(false);
  });

  it('does NOT suppress an unknown Postgres error', () => {
    expect(
      isExpectedMutationError({ code: '08006', message: 'connection failure', details: null, hint: null }),
    ).toBe(false);
    expect(
      isExpectedMutationError({ code: '23503', message: 'insert or update violates foreign key constraint', details: null, hint: null }),
    ).toBe(false);
  });

  it('handles null / primitive / empty inputs', () => {
    expect(isExpectedMutationError(null)).toBe(false);
    expect(isExpectedMutationError(undefined)).toBe(false);
    expect(isExpectedMutationError('boom')).toBe(false);
    expect(isExpectedMutationError({})).toBe(false);
  });
});

describe('isAuthError', () => {
  // The OFF-8 root cause candidate: after >1 h offline the JWT lapses, so a replayed write is rejected
  // for the SESSION, not for the change. That must be retried on a fresh session, not treated as final.
  it('recognises an expired / invalid token however it surfaces', () => {
    expect(isAuthError({ code: 'PGRST301', message: 'JWT expired' })).toBe(true);
    expect(isAuthError({ status: 401, message: 'Unauthorized' })).toBe(true);
    expect(isAuthError({ code: 'P0001', message: 'Not authenticated' })).toBe(true);
    expect(isAuthError(new Error('invalid JWT: unable to parse'))).toBe(true);
  });

  it('does not mistake a real rejection of the change for an auth problem', () => {
    expect(isAuthError({ code: 'P0001', message: 'Split amounts (10) do not sum to expense amount (12)' })).toBe(false);
    expect(isAuthError({ code: '42501', message: 'permission denied for table expenses' })).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });
});

describe('isNetworkError', () => {
  // v1.39.6: a weak/flaky connection where the request never reaches the server at all — the
  // specific shape that used to exhaust retry:3 and roll back a just-created expense's optimistic
  // row (the "expenses disappear completely" report).
  it('recognises a request that never reached the server', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError({ message: 'Load failed' })).toBe(true);
    expect(isNetworkError({ message: 'The request timed out.' })).toBe(true);
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    expect(isNetworkError(abort)).toBe(true);
  });

  // v1.39.6 manual-QA fix: @supabase/postgrest-js wraps a thrown fetch() failure (airplane mode,
  // no network at all) into { message, details, hint, code: '' } — every key present, code just
  // empty, because there's no SQLSTATE to report. This shape used to satisfy the old
  // looksLikePostgresError key-presence gate and get misclassified as "reached the server",
  // causing an instant failure toast + optimistic rollback instead of a pause-and-retry.
  it('recognises a supabase-js-wrapped network failure (empty code — not a real Postgres error)', () => {
    expect(isNetworkError({
      message: 'TypeError: Network request failed',
      details: 'TypeError: Network request failed\n\nCaused by: ...',
      hint: '',
      code: '',
    })).toBe(true);
  });

  it('does NOT treat a real server-side rejection as a network error, regardless of message text', () => {
    expect(isNetworkError({ code: 'P0001', message: 'network error while processing refund', details: null, hint: null })).toBe(false);
    expect(isNetworkError({ code: '42501', message: 'permission denied for table expenses' })).toBe(false);
  });

  it('does NOT treat a bare TypeError with an unrelated message as a network error (a real bug must still surface)', () => {
    expect(isNetworkError(new TypeError("Cannot read properties of undefined (reading 'not found')"))).toBe(false);
  });

  it('handles null / primitive / empty inputs', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError('boom')).toBe(false);
    expect(isNetworkError({})).toBe(false);
  });
});
