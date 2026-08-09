import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import { colors } from '@vacationist/ui';

export function useHighlightAnimation(highlight: boolean | undefined, borderColor: string) {
  const highlightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (highlight) {
      const timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
        ]).start();
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [highlight]);

  // The pulse must land on a color visually distinct from the resting
  // `borderColor` — callers commonly derive borderColor from vote state
  // (getVoteBorderColor), which returns colors.primary itself for a
  // "like"-average score. Animating colors.primary -> colors.primary is a
  // technically-correct no-op: the sequence runs and completes normally,
  // but nothing visible ever changes. colors.primary and colors.success are
  // distinct in every theme (dark/light/colorful), so borderColor can equal
  // at most one of them — falling back to the other always yields a real,
  // visible pulse target.
  const pulseColor = borderColor === colors.primary ? colors.success : colors.primary;

  const animatedBorderColor = highlight
    ? highlightAnim.interpolate({ inputRange: [0, 1], outputRange: [borderColor, pulseColor] })
    : borderColor;

  return { animatedBorderColor };
}
