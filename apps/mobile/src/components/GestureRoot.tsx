import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/**
 * App-level gesture root. Required once near the top of the tree for
 * react-native-gesture-handler to work — Expo Router does not mount one.
 *
 * Note: RN `<Modal>` creates its own native view hierarchy, so sheets that use
 * gestures inside a Modal render their own nested root (see SwipeToDismiss).
 * The `.web.tsx` sibling is a plain passthrough — RNGH is native-only here.
 */
export function GestureRoot({ children }: { children: ReactNode }) {
  return <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>;
}
