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
  }, [highlight]);

  const animatedBorderColor = highlight
    ? highlightAnim.interpolate({ inputRange: [0, 1], outputRange: [borderColor, colors.primary] })
    : borderColor;

  return { animatedBorderColor };
}
