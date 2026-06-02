import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@vacationist/ui';
import { InfoSheet } from '../../../components/InfoSheet';

interface EmptyTopicsProps {
  isOrganizer: boolean;
  onCreateTopic?: () => void;
}

export function EmptyTopics({ isOrganizer, onCreateTopic }: EmptyTopicsProps) {
  const { t } = useTranslation('prework');
  const { t: tCommon } = useTranslation('common');
  const [showInfo, setShowInfo] = useState(false);

  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-2xl">
      <Ionicons name="list-outline" size={48} color={colors.textMuted} />
      <View className="items-center gap-xs">
        <Text className="text-heading-m text-text-primary text-center">{t('emptyTopics.title')}</Text>
        <Text className="text-body-small text-text-secondary text-center">
          {isOrganizer ? t('emptyTopics.organizerSubtitle') : t('emptyTopics.subtitle')}
        </Text>
      </View>
      {isOrganizer && onCreateTopic && (
        <Pressable
          onPress={onCreateTopic}
          className="px-lg py-sm rounded-md bg-primary"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          accessibilityRole="button"
        >
          <Text className="text-white text-body font-semibold">{t('emptyTopics.createButton')}</Text>
        </Pressable>
      )}
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
        title={t('emptyTopics.info.title')}
        content={t('emptyTopics.info.content')}
      />
    </View>
  );
}
