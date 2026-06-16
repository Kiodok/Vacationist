import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, colors , ThemedIcon } from '@vacationist/ui';

interface EmptyTripsProps {
  onCreateTrip: () => void;
}

export function EmptyTrips({ onCreateTrip }: EmptyTripsProps) {
  const { t } = useTranslation('trips');
  return (
    <View className="flex-1 items-center justify-center px-xl">
      <View className="w-[80px] h-[80px] rounded-full bg-primary-muted items-center justify-center mb-lg">
        <ThemedIcon name="airplane-outline" size={36} color={colors.primary} />
      </View>
      <Text className="text-heading-l text-text-primary text-center mb-sm">
        {t('empty.title')}
      </Text>
      <Text className="text-body text-text-secondary text-center mb-xl">
        {t('empty.subtitle')}
      </Text>
      <Button label={t('empty.action')} onPress={onCreateTrip} />
    </View>
  );
}
