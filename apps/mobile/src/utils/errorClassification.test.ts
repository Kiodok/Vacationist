import { describe, it, expect } from 'vitest';
import { isExpectedMutationError } from './errorClassification';

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
