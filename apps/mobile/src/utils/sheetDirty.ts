/**
 * Pure helpers for computing a sheet's "has unsaved input" flag outside react-hook-form's
 * `isDirty` — e.g. a multi-select `Set` with a separate confirm button, or a form built on
 * plain `useState` with no RHF at all. Kept free of React so it's unit-testable (see
 * sheetDirty.test.ts) the same way sheetGesture.ts is.
 */

/** True if two string collections contain exactly the same members, order independent. */
export function sameMembers(a: Iterable<string>, b: Iterable<string>): boolean {
  const setA = a instanceof Set ? a : new Set(a);
  const setB = b instanceof Set ? b : new Set(b);
  if (setA.size !== setB.size) return false;
  for (const value of setA) {
    if (!setB.has(value)) return false;
  }
  return true;
}
