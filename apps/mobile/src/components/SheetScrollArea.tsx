import { useContext, useMemo, type ReactElement } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SheetPanGestureContext } from './SwipeToDismiss';

/**
 * Wrap the single outermost scrollable inside a sheet so a drag that starts on
 * it scrolls (as today) instead of dismissing the sheet.
 *
 *   <SheetScrollArea>
 *     <ScrollView ...>{...}</ScrollView>
 *   </SheetScrollArea>
 *
 * The child MUST be the scrollable element itself (ScrollView / FlatList /
 * FlashList / Animated.ScrollView) — `GestureDetector` needs the native
 * component as its direct child. Props on the scrollable are untouched.
 *
 * Mechanism: a `Gesture.Native()` on the scroll view, declared to
 * `blocksExternalGesture(pan)` — so the sheet's pan waits for the scroll gesture
 * and never activates while the finger is on scrollable content. Outside the
 * scrollable there is no native gesture, so the pan activates normally.
 */
export function SheetScrollArea({ children }: { children: ReactElement }) {
  const pan = useContext(SheetPanGestureContext);

  const native = useMemo(() => {
    const g = Gesture.Native();
    return pan ? g.blocksExternalGesture(pan) : g;
  }, [pan]);

  // Not inside a SwipeToDismiss (shouldn't happen for a sheet) — pass through.
  if (!pan) return children;

  return <GestureDetector gesture={native}>{children}</GestureDetector>;
}
