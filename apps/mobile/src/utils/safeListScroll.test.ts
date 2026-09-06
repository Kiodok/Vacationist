import { describe, it, expect, vi } from 'vitest';
import {
  isSectionScrollTargetInRange,
  isIndexInRange,
  safeScrollToSectionLocation,
  safeScrollToIndex,
} from './safeListScroll';

const sections = [
  { data: ['a', 'b', 'c'] }, // section 0: 3 rows
  { data: [] }, // section 1: empty
  { data: ['x'] }, // section 2: 1 row
];

describe('isSectionScrollTargetInRange', () => {
  it('accepts an in-range target (itemIndex carries the +1 header offset)', () => {
    expect(isSectionScrollTargetInRange(sections, 0, 1)).toBe(true);
    expect(isSectionScrollTargetInRange(sections, 0, 3)).toBe(true); // last row, offset
    expect(isSectionScrollTargetInRange(sections, 2, 1)).toBe(true);
  });

  it('rejects itemIndex past the section length', () => {
    expect(isSectionScrollTargetInRange(sections, 0, 4)).toBe(false);
    expect(isSectionScrollTargetInRange(sections, 2, 2)).toBe(false);
  });

  it('rejects an empty target section', () => {
    expect(isSectionScrollTargetInRange(sections, 1, 0)).toBe(false);
  });

  it('rejects a sectionIndex outside the array (stale/shrunk snapshot)', () => {
    expect(isSectionScrollTargetInRange(sections, 3, 0)).toBe(false);
    expect(isSectionScrollTargetInRange(sections, -1, 0)).toBe(false);
  });

  it('rejects non-integer / negative inputs', () => {
    expect(isSectionScrollTargetInRange(sections, 0, -1)).toBe(false);
    expect(isSectionScrollTargetInRange(sections, 0.5, 1)).toBe(false);
    expect(isSectionScrollTargetInRange(sections, 0, NaN)).toBe(false);
  });
});

describe('isIndexInRange', () => {
  it('accepts 0..count-1', () => {
    expect(isIndexInRange(0, 3)).toBe(true);
    expect(isIndexInRange(2, 3)).toBe(true);
  });
  it('rejects count and beyond', () => {
    expect(isIndexInRange(3, 3)).toBe(false);
    expect(isIndexInRange(23, 22)).toBe(false); // the exact REACT-NATIVE-5 shape
  });
  it('rejects negatives / non-integers', () => {
    expect(isIndexInRange(-1, 3)).toBe(false);
    expect(isIndexInRange(1.5, 3)).toBe(false);
  });
});

describe('safeScrollToSectionLocation', () => {
  it('calls scrollToLocation for an in-range target', () => {
    const scrollToLocation = vi.fn();
    const ok = safeScrollToSectionLocation({ current: { scrollToLocation } as never }, sections, {
      sectionIndex: 0,
      itemIndex: 2,
    });
    expect(ok).toBe(true);
    expect(scrollToLocation).toHaveBeenCalledOnce();
  });

  it('skips (no throw, no call) for an out-of-range target', () => {
    const scrollToLocation = vi.fn();
    const ok = safeScrollToSectionLocation({ current: { scrollToLocation } as never }, sections, {
      sectionIndex: 0,
      itemIndex: 99,
    });
    expect(ok).toBe(false);
    expect(scrollToLocation).not.toHaveBeenCalled();
  });

  it('swallows an Invariant thrown by scrollToLocation despite passing bounds', () => {
    const scrollToLocation = vi.fn(() => {
      throw new Error('scrollToIndex out of range: requested index 23 is out of 0 to 21');
    });
    const ok = safeScrollToSectionLocation({ current: { scrollToLocation } as never }, sections, {
      sectionIndex: 0,
      itemIndex: 1,
    });
    expect(ok).toBe(false);
  });

  it('returns false for a null ref', () => {
    expect(safeScrollToSectionLocation({ current: null }, sections, { sectionIndex: 0, itemIndex: 1 })).toBe(false);
  });
});

describe('safeScrollToIndex', () => {
  it('calls scrollToIndex for an in-range index', () => {
    const scrollToIndex = vi.fn();
    expect(safeScrollToIndex({ current: { scrollToIndex } }, 5, { index: 3 })).toBe(true);
    expect(scrollToIndex).toHaveBeenCalledOnce();
  });

  it('skips an out-of-range index', () => {
    const scrollToIndex = vi.fn();
    expect(safeScrollToIndex({ current: { scrollToIndex } }, 5, { index: 5 })).toBe(false);
    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it('swallows a throw from scrollToIndex', () => {
    const scrollToIndex = vi.fn(() => {
      throw new Error('out of range');
    });
    expect(safeScrollToIndex({ current: { scrollToIndex } }, 5, { index: 1 })).toBe(false);
  });
});
