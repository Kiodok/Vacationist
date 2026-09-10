import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * Web build: swipe-to-dismiss is native-only, so react-native-gesture-handler is
 * deliberately kept out of the web bundle. This is a plain flex container that
 * mirrors the layout role of the native GestureHandlerRootView.
 */
export function GestureRoot({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}
