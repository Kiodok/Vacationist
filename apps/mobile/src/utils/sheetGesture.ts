/**
 * Pure decision logic for the bottom-sheet swipe-to-dismiss gesture.
 *
 * Kept free of React / react-native-gesture-handler / reanimated so it can be
 * unit-tested in the `environment: 'node'` vitest harness (see sheetGesture.test.ts).
 * The gesture wiring that consumes this lives in `src/components/SwipeToDismiss.tsx`.
 */

/**
 * Minimum downward finger travel (px) before the pan gesture activates. Below
 * this a touch is treated as a tap so scrim / header / button presses still work.
 * Fed to `Gesture.Pan().activeOffsetY()`.
 */
export const SHEET_DRAG_ACTIVATE_Y = 10;

/**
 * Horizontal travel (px, each direction) that cancels the pan — lets a
 * horizontal ScrollView inside a sheet win an ambiguous diagonal drag.
 * Fed to `Gesture.Pan().failOffsetX([-X, X])`.
 */
export const SHEET_DRAG_FAIL_X = 20;

/** Absolute cap on the dismiss distance so a very tall sheet doesn't need a huge drag. */
export const SHEET_DISMISS_DISTANCE_CAP = 120;

/** Fraction of the panel height used as the dismiss distance for short sheets. */
export const SHEET_DISMISS_DISTANCE_RATIO = 0.3;

/** A downward fling faster than this (px/s) dismisses regardless of distance travelled. */
export const SHEET_DISMISS_VELOCITY = 800;

export interface SheetDragEndState {
  /** Net vertical translation from the drag origin; positive = downward (react-native-gesture-handler convention). */
  translationY: number;
  /** Vertical velocity at release, px/s; positive = downward. */
  velocityY: number;
  /** Measured height of the sheet panel in px (from onLayout). */
  panelHeight: number;
}

/**
 * The distance the panel must be dragged down to dismiss on release: the lesser
 * of a fixed cap and a fraction of the panel's own height.
 *
 * Marked `worklet` so it can run on the UI thread inside the pan gesture in
 * SwipeToDismiss; also runs fine as a plain function in the node test env.
 */
export function sheetDismissThreshold(panelHeight: number): number {
  'worklet';
  const ratioDistance = Math.max(panelHeight, 0) * SHEET_DISMISS_DISTANCE_RATIO;
  return Math.min(SHEET_DISMISS_DISTANCE_CAP, ratioDistance || SHEET_DISMISS_DISTANCE_CAP);
}

/**
 * Given the state at the moment the finger lifts, should the sheet close?
 * Dismiss on a far-enough downward drag OR a fast-enough downward fling.
 * An upward drag (negative translationY) never dismisses.
 *
 * Marked `worklet` — see sheetDismissThreshold.
 */
export function shouldDismissSheet({ translationY, velocityY, panelHeight }: SheetDragEndState): boolean {
  'worklet';
  if (translationY <= 0) return false;
  if (velocityY > SHEET_DISMISS_VELOCITY) return true;
  return translationY > sheetDismissThreshold(panelHeight);
}
