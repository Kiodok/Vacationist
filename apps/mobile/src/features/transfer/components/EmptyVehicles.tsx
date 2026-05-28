import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '@vacationist/ui';

export function EmptyVehicles() {
  const { t } = useTranslation('transfer');
  return (
    <View className="flex-1 items-center justify-center gap-sm py-xl">
      <View className="w-[72px] h-[72px] rounded-full bg-primary-muted items-center justify-center">
        <Ionicons name="car-outline" size={32} color={colors.primary} />
      </View>
      <Text className="text-heading-s text-text-secondary">{t('vehicles.empty.title')}</Text>
      <Text className="text-body-small text-text-muted text-center px-xl">
        {t('vehicles.empty.subtitle')}
      </Text>
    </View>
  );
}
