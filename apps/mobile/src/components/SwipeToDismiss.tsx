import { createContext, useCallback, useMemo, type ReactNode } from 'react';
import { Platform, Pressable, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  type GestureType,
} from 'react-native-gesture-handler';
import { useResolvedTheme } from '@vacationist/ui';
import {
  SHEET_DRAG_ACTIVATE_Y,
  SHEET_DRAG_FAIL_X,
  shouldDismissSheet,
} from '../utils/sheetGesture';

// NativeWind reliably interops Animated.View's className; Animated-wrapped
// Pressable is dicier, so the scrim is a plain Pressable holding an Animated.View.

/**
 * The sheet's pan gesture, published so a `<SheetScrollArea>` around an inner
 * scrollable can declare that the scroll gesture takes precedence
 * (`Gesture.Native().blocksExternalGesture(pan)` → the pan waits for the scroll).
 * `null` on web and outside a sheet.
 */
export const SheetPanGestureContext = createContext<GestureType | null>(null);

interface SwipeToDismissProps {
  /** Called when the sheet should close — pass the sheet's local `handleClose` (form reset etc.), never the raw `onClose`. */
  onDismiss: () => void;
  /** Panel classes, moved verbatim from the old panel `<View>` (e.g. `bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]`). */
  className?: string;
  /** Panel inline style, moved verbatim (usually `{ paddingBottom: Math.max(insets.bottom, 32) }`). */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Bottom-sheet chrome with swipe-down-to-dismiss. Drop-in replacement for the
 * copy-pasted `<View className="flex-1 justify-end"> + scrim <Pressable> + panel
 * <View>` scaffold.
 *
 * Renders its own `<GestureHandlerRootView>`: on Android an RN `<Modal>` is a
 * separate window the app-level root does not reach, and RNGH requires a root
 * inside the Modal content for gestures to work there. On web the Modal renders
 * in-tree, so this nested root is simply ignored in favour of the app-level one
 * (RNGH uses only the top-most root) — and `pan` + any `<SheetScrollArea>`'s
 * native gesture always share this single root, so their relation holds.
 *
 * The downward drag closes when it starts on the grabber / header / any
 * non-scrolling area; a drag that starts inside a `<SheetScrollArea>`-wrapped
 * scrollable scrolls instead. See sheetGesture.ts for the thresholds.
 */
export function SwipeToDismiss({ onDismiss, className, style, children }: SwipeToDismissProps) {
  const isColorful = useResolvedTheme() === 'colorful';
  const translateY = useSharedValue(0);
  const panelHeight = useSharedValue(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      panelHeight.value = e.nativeEvent.layout.height;
    },
    [panelHeight],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Single positive number = down-only activation: an upward drag never
        // leaves the (-inf, 10] range so it never activates. Intentional — the
        // sheet is dismissed by dragging *down*.
        .activeOffsetY(SHEET_DRAG_ACTIVATE_Y)
        .failOffsetX([-SHEET_DRAG_FAIL_X, SHEET_DRAG_FAIL_X])
        .onUpdate((e) => {
          translateY.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          const dismiss = shouldDismissSheet({
            translationY: e.translationY,
            velocityY: e.velocityY,
            panelHeight: panelHeight.value,
          });
          if (dismiss) {
            const target = panelHeight.value > 0 ? panelHeight.value : 600;
            translateY.value = withTiming(target, { duration: 160 }, (finished) => {
              if (finished) {
                scheduleOnRN(onDismiss);
              }
            });
          } else {
            translateY.value = withSpring(0, { damping: 22, stiffness: 220, overshootClamping: true });
          }
        }),
    [onDismiss, panelHeight, translateY],
  );

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const scrimStyle = useAnimatedStyle(() => {
    const span = panelHeight.value > 0 ? panelHeight.value : 400;
    return { opacity: interpolate(translateY.value, [0, span], [1, 0], Extrapolation.CLAMP) };
  });

  return (
    <SheetPanGestureContext.Provider value={pan}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0" onPress={onDismiss}>
            <Animated.View className="flex-1 bg-background/80" style={scrimStyle} />
          </Pressable>
          <GestureDetector gesture={pan}>
            <Animated.View
              onLayout={onLayout}
              className={className}
              style={[
                style,
                panelStyle,
                isColorful && Platform.OS === 'web' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : null,
              ]}
            >
              {children}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </SheetPanGestureContext.Provider>
  );
}
