import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@vacationist/ui';

export function EmptyNotes() {
  const { t } = useTranslation('notes');
  return (
    <View className="flex-1 items-center justify-center px-xl gap-md py-xl">
      <View className="w-[80px] h-[80px] rounded-full bg-primary-muted items-center justify-center">
        <Ionicons name="document-text-outline" size={36} color={colors.primary} />
      </View>
      <Text className="text-heading-m text-text-primary text-center">{t('empty.title')}</Text>
      <Text className="text-body-small text-text-secondary text-center">
        {t('empty.subtitle')}
      </Text>
    </View>
  );
}
