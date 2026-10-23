import { describe, it, expect } from 'vitest';
import { sameMembers } from './sheetDirty';

describe('sameMembers', () => {
  it('is true for identical sets regardless of insertion order', () => {
    expect(sameMembers(new Set(['a', 'b', 'c']), new Set(['c', 'a', 'b']))).toBe(true);
  });

  it('is true for empty collections', () => {
    expect(sameMembers([], [])).toBe(true);
  });

  it('is false when sizes differ', () => {
    expect(sameMembers(['a', 'b'], ['a'])).toBe(false);
  });

  it('is false when sizes match but contents differ', () => {
    expect(sameMembers(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('accepts a plain array on either side', () => {
    expect(sameMembers(['a', 'b'], new Set(['b', 'a']))).toBe(true);
  });
});
