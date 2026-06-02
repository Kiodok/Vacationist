import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

interface CollapsibleSectionHeaderProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  textClass: string;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  iconSize?: number;
}

export function CollapsibleSectionHeader({
  icon,
  iconColor,
  textClass,
  title,
  count,
  collapsed,
  onToggle,
  iconSize = 16,
}: CollapsibleSectionHeaderProps) {
  // 0 = expanded (chevron points down), 1 = collapsed (chevron points right)
  const rotation = useSharedValue(collapsed ? 1 : 0);

  useEffect(() => {
    rotation.value = withTiming(collapsed ? 1 : 0, { duration: 200 });
  }, [collapsed]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(rotation.value, [0, 1], [0, -90])}deg` },
    ],
  }));

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed }}
      accessibilityLabel={`${title} (${count})`}
      className="flex-row items-center gap-xs pt-md pb-sm px-xs"
    >
      <Ionicons name={icon} size={iconSize} color={iconColor} />
      <Text className={`text-body font-semibold ${textClass}`}>{title}</Text>
      <Text className="text-body-small text-text-muted">({count})</Text>
      <View className="flex-1" />
      <Animated.View style={chevronStyle}>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Animated.View>
    </Pressable>
  );
}
