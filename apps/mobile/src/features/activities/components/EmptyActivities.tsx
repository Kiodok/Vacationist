import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors , ThemedIcon } from '@vacationist/ui';
import { InfoSheet } from '../../../components/InfoSheet';

export function EmptyActivities() {
  const { t } = useTranslation('activities');
  const { t: tCommon } = useTranslation('common');
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <View className="w-[80px] h-[80px] rounded-full bg-primary-muted items-center justify-center">
        <ThemedIcon name="compass-outline" size={36} color={colors.primary} />
      </View>
      <Text className="text-heading-m text-text-primary text-center">{t('empty.title')}</Text>
      <Text className="text-body-small text-text-secondary text-center">
        {t('empty.subtitle')}
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
        title={t('info.title')}
        content={t('info.content')}
      />
    </View>
  );
}
