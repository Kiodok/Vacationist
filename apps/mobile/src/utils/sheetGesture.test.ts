import { describe, it, expect } from 'vitest';
import {
  shouldDismissSheet,
  sheetDismissThreshold,
  SHEET_DISMISS_DISTANCE_CAP,
  SHEET_DISMISS_VELOCITY,
} from './sheetGesture';

describe('sheetDismissThreshold', () => {
  it('uses the 30% rule for short sheets', () => {
    expect(sheetDismissThreshold(200)).toBe(60);
  });

  it('caps the distance for tall sheets', () => {
    expect(sheetDismissThreshold(900)).toBe(SHEET_DISMISS_DISTANCE_CAP);
  });

  it('falls back to the cap when the panel height is not yet measured', () => {
    expect(sheetDismissThreshold(0)).toBe(SHEET_DISMISS_DISTANCE_CAP);
  });
});

describe('shouldDismissSheet', () => {
  const base = { translationY: 0, velocityY: 0, panelHeight: 600 };

  it('does not dismiss a small slow drag', () => {
    expect(shouldDismissSheet({ ...base, translationY: 40, velocityY: 100 })).toBe(false);
  });

  it('dismisses once dragged past the distance threshold', () => {
    // 600px panel -> cap of 120px applies
    expect(shouldDismissSheet({ ...base, translationY: 130, velocityY: 0 })).toBe(true);
    expect(shouldDismissSheet({ ...base, translationY: 110, velocityY: 0 })).toBe(false);
  });

  it('dismisses a fast downward flick even at a small distance', () => {
    expect(
      shouldDismissSheet({ ...base, translationY: 30, velocityY: SHEET_DISMISS_VELOCITY + 1 }),
    ).toBe(true);
  });

  it('never dismisses an upward drag, however fast', () => {
    expect(shouldDismissSheet({ ...base, translationY: -300, velocityY: 5000 })).toBe(false);
    expect(shouldDismissSheet({ ...base, translationY: -10, velocityY: 0 })).toBe(false);
  });

  it('uses the panel-relative threshold for a short sheet', () => {
    // 180px panel -> 54px threshold, so 60px dismisses but would not on a tall sheet
    expect(shouldDismissSheet({ translationY: 60, velocityY: 0, panelHeight: 180 })).toBe(true);
    expect(shouldDismissSheet({ translationY: 50, velocityY: 0, panelHeight: 180 })).toBe(false);
  });

  it('treats an exactly-zero drag as no dismiss', () => {
    expect(shouldDismissSheet({ ...base, translationY: 0, velocityY: 0 })).toBe(false);
  });
});
