import { describe, it, expect } from 'vitest';
import { isMutationBusy } from './mutationStatus';

describe('isMutationBusy', () => {
  it('is busy while pending and not paused (online in-flight)', () => {
    expect(isMutationBusy({ isPending: true, isPaused: false })).toBe(true);
  });

  it('is not busy while paused offline (queued for later sync)', () => {
    expect(isMutationBusy({ isPending: true, isPaused: true })).toBe(false);
  });

  it('is not busy when idle or settled', () => {
    expect(isMutationBusy({ isPending: false, isPaused: false })).toBe(false);
    expect(isMutationBusy({ isPending: false, isPaused: true })).toBe(false);
  });
});
