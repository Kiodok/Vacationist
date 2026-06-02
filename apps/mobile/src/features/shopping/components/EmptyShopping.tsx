import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@vacationist/ui';
import { InfoSheet } from '../../../components/InfoSheet';

export function EmptyShopping() {
  const { t } = useTranslation('shopping');
  const { t: tCommon } = useTranslation('common');
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <View className="w-[80px] h-[80px] rounded-full bg-warning-muted items-center justify-center">
        <Ionicons name="cart-outline" size={36} color={colors.warning} />
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
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
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
