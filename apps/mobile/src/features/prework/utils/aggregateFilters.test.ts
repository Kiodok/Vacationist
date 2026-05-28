import { describe, it, expect } from 'vitest';
import { aggregateFilters, getRecommendedLabels } from './aggregateFilters';
import type { PreworkPreferences } from '@vacationist/types';

function prefs(
  userId: string,
  filters: { label: string; weight: number }[],
): PreworkPreferences {
  return {
    id: `pref-${userId}`,
    trip_id: 'trip-1',
    user_id: userId,
    filters,
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('aggregateFilters', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateFilters([])).toEqual([]);
  });

  it('returns empty array when all members have no filters', () => {
    expect(aggregateFilters([prefs('a', []), prefs('b', [])])).toEqual([]);
  });

  it('groups identical labels and sums credits', () => {
    const result = aggregateFilters([
      prefs('a', [{ label: 'Pool', weight: 40 }]),
      prefs('b', [{ label: 'Pool', weight: 60 }]),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].totalCredits).toBe(100);
    expect(result[0].memberCount).toBe(2);
  });

  it('groups labels case-insensitively', () => {
    const result = aggregateFilters([
      prefs('a', [{ label: 'pool', weight: 30 }]),
      prefs('b', [{ label: 'Pool', weight: 70 }]),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].totalCredits).toBe(100);
  });

  it('picks the most frequent exact casing as display label', () => {
    const result = aggregateFilters([
      prefs('a', [{ label: 'pool', weight: 30 }]),
      prefs('b', [{ label: 'Pool', weight: 40 }]),
      prefs('c', [{ label: 'Pool', weight: 30 }]),
    ]);
    expect(result[0].label).toBe('Pool');
  });

  it('sorts by totalCredits descending', () => {
    const result = aggregateFilters([
      prefs('a', [
        { label: 'Beach', weight: 20 },
        { label: 'Pool', weight: 80 },
      ]),
    ]);
    expect(result[0].label).toBe('Pool');
    expect(result[1].label).toBe('Beach');
  });

  it('records breakdown entries per member with correct userId and weight', () => {
    const result = aggregateFilters([
      prefs('a', [{ label: 'Wifi', weight: 50 }]),
      prefs('b', [{ label: 'Wifi', weight: 50 }]),
    ]);
    expect(result[0].breakdown).toEqual([
      { userId: 'a', weight: 50 },
      { userId: 'b', weight: 50 },
    ]);
  });

  it('ignores whitespace-only labels', () => {
    const result = aggregateFilters([prefs('a', [{ label: '   ', weight: 50 }])]);
    expect(result).toHaveLength(0);
  });

  it('handles a single member with multiple distinct filters', () => {
    const result = aggregateFilters([
      prefs('a', [
        { label: 'Wifi', weight: 40 },
        { label: 'Parking', weight: 60 },
      ]),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Parking'); // higher credit first
    expect(result[1].label).toBe('Wifi');
  });
});

describe('getRecommendedLabels', () => {
  it('returns empty array when only the current user has preferences', () => {
    const result = getRecommendedLabels(
      [prefs('me', [{ label: 'Pool', weight: 100 }])],
      'me',
      [],
    );
    expect(result).toEqual([]);
  });

  it('excludes labels already in myFilterLabels (case-insensitive)', () => {
    const result = getRecommendedLabels(
      [prefs('other', [{ label: 'Pool', weight: 100 }])],
      'me',
      ['pool'],
    );
    expect(result).toEqual([]);
  });

  it('returns other members labels not already selected', () => {
    const result = getRecommendedLabels(
      [prefs('other', [{ label: 'Beach', weight: 60 }, { label: 'Wifi', weight: 40 }])],
      'me',
      ['Beach'],
    );
    expect(result).toContain('Wifi');
    expect(result).not.toContain('Beach');
  });

  it('deduplicates labels across multiple other members', () => {
    const result = getRecommendedLabels(
      [
        prefs('b', [{ label: 'Pool', weight: 100 }]),
        prefs('c', [{ label: 'Pool', weight: 100 }]),
      ],
      'me',
      [],
    );
    expect(result.filter((l) => l === 'Pool')).toHaveLength(1);
  });

  it('works when currentUserId is undefined (treats all as other members)', () => {
    const result = getRecommendedLabels(
      [prefs('other', [{ label: 'Beach', weight: 100 }])],
      undefined,
      [],
    );
    expect(result).toContain('Beach');
  });

  it('returns empty array when all other members labels are already selected', () => {
    const result = getRecommendedLabels(
      [prefs('other', [{ label: 'Pool', weight: 100 }])],
      'me',
      ['Pool'],
    );
    expect(result).toEqual([]);
  });
});
