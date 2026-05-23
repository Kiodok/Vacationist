import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';

interface Props {
  onPress: () => void;
}

export function GuestUpgradeBanner({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-sm bg-surface border border-primary rounded-md px-md py-sm"
    >
      <Ionicons name="person-add-outline" size={20} color={colors.primary} />
      <View className="flex-1">
        <Text className="text-body text-text-primary font-semibold">You're browsing as a guest</Text>
        <Text className="text-body-small text-text-muted">Save your account to keep your data</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}
