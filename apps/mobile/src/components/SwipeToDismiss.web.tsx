import { createContext, type ReactNode } from 'react';
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useResolvedTheme } from '@vacationist/ui';

/**
 * Web build: swipe-to-dismiss is native-only (Tech Lead decision, 2026-09-10).
 * This renders the exact same DOM the sheets had before — `flex-1 justify-end`
 * container, tap-to-close scrim, panel — minus any gesture. Keeps
 * react-native-gesture-handler out of the web bundle entirely.
 */

// Kept type-compatible with the native file's export; always null here.
export const SheetPanGestureContext = createContext<unknown | null>(null);

interface SwipeToDismissProps {
  onDismiss: () => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export function SwipeToDismiss({ onDismiss, className, style, children }: SwipeToDismissProps) {
  const isColorful = useResolvedTheme() === 'colorful';
  return (
    <View className="flex-1 justify-end">
      <Pressable className="absolute inset-0 bg-background/80" onPress={onDismiss} />
      <View
        className={className}
        style={[
          style,
          isColorful && Platform.OS === 'web' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : null,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
