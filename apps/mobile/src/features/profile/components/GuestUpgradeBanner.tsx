import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors , ThemedIcon } from '@vacationist/ui';

interface Props {
  onPress: () => void;
}

export function GuestUpgradeBanner({ onPress }: Props) {
  const { t } = useTranslation('profile');
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-sm bg-surface border border-primary rounded-md px-md py-sm"
    >
      <ThemedIcon name="person-add-outline" size={20} color={colors.primary} />
      <View className="flex-1">
        <Text className="text-body text-text-primary font-semibold">{t('guest.banner')}</Text>
        <Text className="text-body-small text-text-muted">{t('guest.bannerSubtitle')}</Text>
      </View>
      <ThemedIcon name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}
