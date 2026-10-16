import { createContext, useCallback, useMemo, type ReactNode } from 'react';
import { Platform, Pressable, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
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
  /** v1.39.6 fix: set when `onDismiss` might NOT actually dismiss (e.g. it shows a "discard
   * changes?" confirm instead of closing) — a reanimated SharedValue so the gesture's `onEnd`
   * worklet can read it synchronously on the UI thread. `true` at release time blocks the dismiss:
   * the panel springs back to 0 (same as a drag that never crossed the threshold) instead of
   * sliding fully off-screen and calling `onDismiss` — which previously left the panel invisible
   * with no way back, since `onDismiss` didn't actually close it. Omit for ordinary sheets where
   * `onDismiss` always really dismisses — the backdrop tap below needs no such guard, since it has
   * no slide animation to get stuck in. */
  dismissGuard?: SharedValue<boolean>;
  /** Fires when a dismiss attempt was blocked by `dismissGuard` — the caller's cue to show its own
   * confirmation while the panel is still fully visible. */
  onDismissBlocked?: () => void;
  /** Panel classes, moved verbatim from the old panel `<View>` (e.g. `bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]`). */
  className?: string;
  /** Panel inline style, moved verbatim (usually `{ paddingBottom: Math.max(insets.bottom, 32) + 16 }`). */
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
export function SwipeToDismiss({ onDismiss, dismissGuard, onDismissBlocked, className, style, children }: SwipeToDismissProps) {
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
          // Checked BEFORE committing to the slide-away animation, not after — onDismiss might
          // not actually dismiss (see dismissGuard's doc comment), and discovering that only once
          // the panel has already finished sliding off-screen leaves it invisible with no way back.
          const blocked = dismiss && dismissGuard?.value === true;
          if (dismiss && !blocked) {
            const target = panelHeight.value > 0 ? panelHeight.value : 600;
            translateY.value = withTiming(target, { duration: 160 }, (finished) => {
              if (finished) {
                scheduleOnRN(onDismiss);
              }
            });
          } else {
            translateY.value = withSpring(0, { damping: 22, stiffness: 220, overshootClamping: true });
            if (blocked && onDismissBlocked) {
              scheduleOnRN(onDismissBlocked);
            }
          }
        }),
    [onDismiss, onDismissBlocked, dismissGuard, panelHeight, translateY],
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
