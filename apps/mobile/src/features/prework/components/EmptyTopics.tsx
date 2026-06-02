import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@vacationist/ui';

interface EmptyTopicsProps {
  isOrganizer: boolean;
  onCreateTopic?: () => void;
}

export function EmptyTopics({ isOrganizer, onCreateTopic }: EmptyTopicsProps) {
  const { t } = useTranslation('prework');

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
        >
          <Text className="text-white text-body font-semibold">{t('emptyTopics.createButton')}</Text>
        </Pressable>
      )}
    </View>
  );
}
