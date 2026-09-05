import { describe, it, expect } from 'vitest';
import { computeDonutArcs } from './donutChart';

const OPTS = { size: 140, strokeWidth: 22 };
const RADIUS = (140 - 22) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

describe('computeDonutArcs', () => {
  it('returns an empty array for no segments', () => {
    expect(computeDonutArcs([], OPTS)).toEqual([]);
  });

  it('returns an empty array when every amount is zero (grand total <= 0)', () => {
    expect(computeDonutArcs([{ category: 'a', amount: 0 }, { category: 'b', amount: 0 }], OPTS)).toEqual([]);
  });

  it('filters out zero-amount segments but keeps the rest', () => {
    const arcs = computeDonutArcs([{ category: 'a', amount: 0 }, { category: 'b', amount: 100 }], OPTS);
    expect(arcs).toHaveLength(1);
    expect(arcs[0].category).toBe('b');
  });

  describe('percentages', () => {
    it('the single field used by both the in-slice label and the legend sums to the expected split', () => {
      const arcs = computeDonutArcs([{ category: 'a', amount: 75 }, { category: 'b', amount: 25 }], OPTS);
      expect(arcs[0].percent).toBe(75);
      expect(arcs[1].percent).toBe(25);
    });

    it('a single 100%-share category reports percent 100, not 99 from a rounding slip', () => {
      const arcs = computeDonutArcs([{ category: 'only', amount: 42 }], OPTS);
      expect(arcs[0].percent).toBe(100);
    });

    it('three equal thirds sum to 100, not 99 from independently-rounded shares', () => {
      const arcs = computeDonutArcs(
        [{ category: 'a', amount: 100 }, { category: 'b', amount: 100 }, { category: 'c', amount: 100 }],
        OPTS,
      );
      const total = arcs.reduce((sum, a) => sum + a.percent, 0);
      expect(total).toBe(100);
      // Each share still rounds to ~33 — only one segment absorbs the leftover point.
      expect(arcs.every((a) => a.percent === 33 || a.percent === 34)).toBe(true);
    });

    it('seven equal sevenths still sum to exactly 100 across many segments', () => {
      const arcs = computeDonutArcs(
        Array.from({ length: 7 }, (_, i) => ({ category: `c${i}`, amount: 100 })),
        OPTS,
      );
      expect(arcs.reduce((sum, a) => sum + a.percent, 0)).toBe(100);
    });
  });

  describe('single-category geometry (no gap applied)', () => {
    it('a lone category gets the full circumference as its dash length — no GAP subtracted', () => {
      const arcs = computeDonutArcs([{ category: 'only', amount: 42 }], OPTS);
      expect(arcs).toHaveLength(1);
      expect(arcs[0].dash).toBeCloseTo(CIRCUMFERENCE, 5);
    });

    it('a lone category starts (and thus is centered) at the -90 (12 o\'clock) baseline', () => {
      const arcs = computeDonutArcs([{ category: 'only', amount: 42 }], OPTS);
      // A full circle's "midpoint" is 180 degrees around from its start.
      expect(arcs[0].midAngleDeg).toBeCloseTo(-90 + 180, 5);
    });
  });

  describe('multi-category geometry (gap applied, dash lengths sum correctly)', () => {
    it('applies the gap only when there are 2+ segments', () => {
      const arcs = computeDonutArcs([{ category: 'a', amount: 50 }, { category: 'b', amount: 50 }], { ...OPTS, gap: 10 });
      // Each segment is exactly half the circle; each dash should be short by the 10px gap.
      expect(arcs[0].dash).toBeCloseTo(CIRCUMFERENCE / 2 - 10, 5);
      expect(arcs[1].dash).toBeCloseTo(CIRCUMFERENCE / 2 - 10, 5);
    });

    it('dash never goes negative even if the gap exceeds a very thin slice\'s raw arc length', () => {
      // A 1%-share slice on a small circle with a large gap would otherwise compute negative.
      const arcs = computeDonutArcs([{ category: 'tiny', amount: 1 }, { category: 'rest', amount: 99 }], { ...OPTS, gap: 1000 });
      expect(arcs[0].dash).toBe(0);
    });
  });

  describe('angle correctness (the most likely spot for a silent sign/offset error)', () => {
    it('places each arc\'s midpoint inside its own sweep window, in category order', () => {
      // Four equal 25% quadrants starting at -90deg: [-90,0), [0,90), [90,180), [180,270).
      const arcs = computeDonutArcs(
        [
          { category: 'q1', amount: 25 },
          { category: 'q2', amount: 25 },
          { category: 'q3', amount: 25 },
          { category: 'q4', amount: 25 },
        ],
        OPTS,
      );
      expect(arcs[0].midAngleDeg).toBeCloseTo(-45, 5);
      expect(arcs[1].midAngleDeg).toBeCloseTo(45, 5);
      expect(arcs[2].midAngleDeg).toBeCloseTo(135, 5);
      expect(arcs[3].midAngleDeg).toBeCloseTo(225, 5);
    });

    it('an unequal split still lands each midpoint inside the correct sweep, not the neighbor\'s', () => {
      // a: 10% -> [-90, -54); b: 80% -> [-54, 234); c: 10% -> [234, 270)
      const arcs = computeDonutArcs(
        [
          { category: 'a', amount: 10 },
          { category: 'b', amount: 80 },
          { category: 'c', amount: 10 },
        ],
        OPTS,
      );
      expect(arcs[0].midAngleDeg).toBeGreaterThan(-90);
      expect(arcs[0].midAngleDeg).toBeLessThan(-54);
      expect(arcs[1].midAngleDeg).toBeGreaterThan(-54);
      expect(arcs[1].midAngleDeg).toBeLessThan(234);
      expect(arcs[2].midAngleDeg).toBeGreaterThan(234);
      expect(arcs[2].midAngleDeg).toBeLessThan(270);
    });
  });

  it('preserves input order rather than re-sorting by amount ("color follows the entity, never its rank")', () => {
    const arcs = computeDonutArcs([{ category: 'small', amount: 5 }, { category: 'big', amount: 95 }], OPTS);
    expect(arcs.map((a) => a.category)).toEqual(['small', 'big']);
  });
});
