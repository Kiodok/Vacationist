import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors , ThemedIcon } from '@vacationist/ui';
import { InfoSheet } from '../../../components/InfoSheet';

export function EmptyRentals() {
  const { t } = useTranslation('transfer');
  const { t: tCommon } = useTranslation('common');
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View className="flex-1 items-center justify-center gap-sm py-xl">
      <View className="w-[72px] h-[72px] rounded-full bg-warning-muted items-center justify-center">
        <ThemedIcon name="key-outline" size={32} color={colors.warning} />
      </View>
      <Text className="text-heading-s text-text-secondary">{t('rentals.empty.title')}</Text>
      <Text className="text-body-small text-text-muted text-center px-xl">
        {t('rentals.empty.subtitle')}
      </Text>
      <Pressable
        onPress={() => setShowInfo(true)}
        className="flex-row items-center gap-xs px-md py-xs rounded-full bg-primary-muted"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        accessibilityRole="button"
        accessibilityLabel={tCommon('button.info')}
      >
        <ThemedIcon name="information-circle-outline" size={18} color={colors.primary} />
        <Text className="text-body-small text-primary font-semibold">{tCommon('button.info')}</Text>
      </Pressable>
      <InfoSheet
        visible={showInfo}
        onClose={() => setShowInfo(false)}
        title={t('rentals.info.title')}
        content={t('rentals.info.content')}
      />
    </View>
  );
}
