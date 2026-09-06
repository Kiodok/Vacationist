import type { SectionList } from 'react-native';

// `SectionList.scrollToLocation` (and `FlatList.scrollToIndex`) throw a hard
// `Invariant Violation: scrollToIndex out of range` when the target indices were
// computed against a different data snapshot than the one the list currently
// holds — a realtime reshuffle, pagination advancing, a section collapsing, or
// clock-based re-bucketing between the moment the target is computed (often in a
// `setTimeout`) and the moment the scroll runs. That invariant is thrown
// synchronously and is NOT delivered to `onScrollToIndexFailed`, so it crashes
// the screen (Sentry REACT-NATIVE-5).
//
// These helpers validate the target against the array we're about to render with
// and swallow any residual timing race, recording a breadcrumb instead of
// throwing.

type MinSection = { data: readonly unknown[] };

// Lazy so this module stays side-effect-free and unit-testable in a plain node
// environment (the pure `*InRange` predicates below carry the real logic).
function breadcrumb(message: string, data: Record<string, unknown>): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
    Sentry.addBreadcrumb({ category: 'scroll', level: 'info', message, data });
  } catch {
    // Sentry unavailable (tests) — nothing to do.
  }
}

/**
 * True when `{sectionIndex, itemIndex}` is a valid target for the given sections.
 * `itemIndex` is expected to already carry the `+1` header offset used at every
 * call site (flat index 0 within a section is the section header itself), so the
 * valid range for it is `[0, section.data.length]`.
 */
export function isSectionScrollTargetInRange(
  sections: readonly MinSection[],
  sectionIndex: number,
  itemIndex: number,
): boolean {
  if (
    !Number.isInteger(sectionIndex) ||
    !Number.isInteger(itemIndex) ||
    sectionIndex < 0 ||
    sectionIndex >= sections.length ||
    itemIndex < 0
  ) {
    return false;
  }
  const section = sections[sectionIndex];
  return !!section && section.data.length > 0 && itemIndex <= section.data.length;
}

/** True when `index` is a valid row index for a list of `itemCount` rows. */
export function isIndexInRange(index: number, itemCount: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < itemCount;
}

interface SectionScrollTarget {
  sectionIndex: number;
  itemIndex: number;
  animated?: boolean;
  viewOffset?: number;
  viewPosition?: number;
}

/**
 * Bounds-checked `SectionList.scrollToLocation`.
 * @returns true if the scroll was issued, false if it was skipped or swallowed.
 */
export function safeScrollToSectionLocation(
  ref: { current: SectionList<any, any> | null } | null | undefined,
  sections: readonly MinSection[],
  target: SectionScrollTarget,
): boolean {
  const list = ref?.current;
  if (!list) return false;

  const { sectionIndex, itemIndex } = target;
  if (!isSectionScrollTargetInRange(sections, sectionIndex, itemIndex)) return false;

  try {
    list.scrollToLocation({
      sectionIndex,
      itemIndex,
      animated: target.animated ?? true,
      viewOffset: target.viewOffset ?? 0,
      viewPosition: target.viewPosition ?? 0,
    });
    return true;
  } catch (e) {
    breadcrumb('safeScrollToSectionLocation: swallowed scroll error', {
      sectionIndex,
      itemIndex,
      sectionCount: sections.length,
      error: String((e as Error)?.message ?? e),
    });
    return false;
  }
}

interface IndexScrollParams {
  index: number;
  animated?: boolean;
  viewOffset?: number;
  viewPosition?: number;
}

/**
 * Bounds-checked `FlatList` / `FlashList` `scrollToIndex`.
 * @param itemCount total number of rows currently in the list's data.
 * @returns true if the scroll was issued, false if it was skipped or swallowed.
 */
export function safeScrollToIndex(
  ref:
    | { current: { scrollToIndex: (params: IndexScrollParams) => void } | null }
    | null
    | undefined,
  itemCount: number,
  params: IndexScrollParams,
): boolean {
  const list = ref?.current;
  if (!list) return false;
  if (!isIndexInRange(params.index, itemCount)) return false;

  try {
    list.scrollToIndex({ animated: true, ...params });
    return true;
  } catch (e) {
    breadcrumb('safeScrollToIndex: swallowed scroll error', {
      index: params.index,
      itemCount,
      error: String((e as Error)?.message ?? e),
    });
    return false;
  }
}
