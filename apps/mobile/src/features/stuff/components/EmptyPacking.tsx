import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export function EmptyPacking() {
  const { t } = useTranslation('stuff');
  return (
    <View className="flex-1 items-center justify-center gap-sm px-xl">
      <Ionicons name="bag-outline" size={48} color="#5C5C5C" />
      <Text className="text-heading-m text-text-primary text-center">{t('private.empty.title')}</Text>
      <Text className="text-body text-text-secondary text-center">{t('private.empty.subtitle')}</Text>
    </View>
  );
}

export function EmptySharedPacking() {
  const { t } = useTranslation('stuff');
  return (
    <View className="flex-1 items-center justify-center gap-sm px-xl">
      <Ionicons name="people-outline" size={48} color="#5C5C5C" />
      <Text className="text-heading-m text-text-primary text-center">{t('shared.empty.title')}</Text>
      <Text className="text-body text-text-secondary text-center">{t('shared.empty.subtitle')}</Text>
    </View>
  );
}

export function EmptyLostFound() {
  const { t } = useTranslation('stuff');
  return (
    <View className="flex-1 items-center justify-center gap-sm px-xl">
      <Ionicons name="search-outline" size={48} color="#5C5C5C" />
      <Text className="text-heading-m text-text-primary text-center">{t('lostFound.empty.title')}</Text>
      <Text className="text-body text-text-secondary text-center">{t('lostFound.empty.subtitle')}</Text>
    </View>
  );
}
