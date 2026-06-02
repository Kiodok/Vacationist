import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@vacationist/ui';
import { InfoSheet } from '../../../components/InfoSheet';

export function EmptyPacking() {
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View className="flex-1 items-center justify-center gap-sm px-xl">
      <Ionicons name="bag-outline" size={48} color={colors.textMuted} />
      <Text className="text-heading-m text-text-primary text-center">{t('private.empty.title')}</Text>
      <Text className="text-body text-text-secondary text-center">{t('private.empty.subtitle')}</Text>
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
        title={t('private.info.title')}
        content={t('private.info.content')}
      />
    </View>
  );
}

export function EmptySharedPacking() {
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View className="flex-1 items-center justify-center gap-sm px-xl">
      <Ionicons name="people-outline" size={48} color={colors.textMuted} />
      <Text className="text-heading-m text-text-primary text-center">{t('shared.empty.title')}</Text>
      <Text className="text-body text-text-secondary text-center">{t('shared.empty.subtitle')}</Text>
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
        title={t('shared.info.title')}
        content={t('shared.info.content')}
      />
    </View>
  );
}

export function EmptyLostFound() {
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View className="flex-1 items-center justify-center gap-sm px-xl">
      <Ionicons name="search-outline" size={48} color={colors.textMuted} />
      <Text className="text-heading-m text-text-primary text-center">{t('lostFound.empty.title')}</Text>
      <Text className="text-body text-text-secondary text-center">{t('lostFound.empty.subtitle')}</Text>
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
        title={t('lostFound.info.title')}
        content={t('lostFound.info.content')}
      />
    </View>
  );
}
