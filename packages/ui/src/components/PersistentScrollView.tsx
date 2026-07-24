import React, { useCallback } from 'react';
import { View } from 'react-native';
import type { ScrollViewProps, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useThemeColors } from '../theme';

const TRACK_W = 4;
const TRACK_INSET = 2;
const MIN_THUMB = 32;
const MARGIN = 6;

type Props = ScrollViewProps & {
  contentContainerClassName?: string;
};

// Typed to accept NativeWind's contentContainerClassName and Reanimated's onScroll handler.
const AnimatedScrollView = Animated.ScrollView as unknown as React.ComponentType<Props>;

export function PersistentScrollView({
  children,
  style,
  onLayout: outerOnLayout,
  onContentSizeChange: outerOnContentSizeChange,
  // Consumed internally — not forwarded.
  onScroll: _onScroll,
  scrollEventThrottle: _scrollEventThrottle,
  ...props
}: Props) {
  const colors = useThemeColors();

  const scrollY = useSharedValue(0);
  const contentH = useSharedValue(0);
  const viewportH = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewportH.value = e.nativeEvent.layout.height;
      outerOnLayout?.(e);
    },
    [viewportH, outerOnLayout]
  );

  const handleContentSizeChange = useCallback(
    (w: number, h: number) => {
      contentH.value = h;
      outerOnContentSizeChange?.(w, h);
    },
    [contentH, outerOnContentSizeChange]
  );

  const trackAnimStyle = useAnimatedStyle(() => ({
    opacity: contentH.value > viewportH.value ? 0.35 : 0,
  }));

  const thumbAnimStyle = useAnimatedStyle(() => {
    const vh = viewportH.value;
    const ch = contentH.value;
    const trackH = vh - MARGIN * 2;

    if (ch <= vh || trackH <= 0) {
      return { height: MIN_THUMB, transform: [{ translateY: 0 }], opacity: 0 };
    }

    const thumbH = Math.max(MIN_THUMB, (vh / ch) * trackH);
    const thumbOffset = interpolate(
      scrollY.value,
      [0, ch - vh],
      [0, trackH - thumbH],
      Extrapolation.CLAMP
    );

    return {
      height: thumbH,
      transform: [{ translateY: thumbOffset }],
      opacity: 0.7,
    };
  });

  return (
    <View style={[{ flex: 1 }, style]}>
      <AnimatedScrollView
        {...props}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onLayout={handleLayout}
        onContentSizeChange={handleContentSizeChange}
        style={{ flex: 1 }}
      >
        {children}
      </AnimatedScrollView>

      {/* Scrollbar track */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            right: TRACK_INSET,
            top: MARGIN,
            bottom: MARGIN,
            width: TRACK_W,
            borderRadius: TRACK_W / 2,
            backgroundColor: colors.border,
          },
          trackAnimStyle,
        ]}
      />

      {/* Scrollbar thumb */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            right: TRACK_INSET,
            top: MARGIN,
            width: TRACK_W,
            borderRadius: TRACK_W / 2,
            backgroundColor: colors.textMuted,
          },
          thumbAnimStyle,
        ]}
      />
    </View>
  );
}
