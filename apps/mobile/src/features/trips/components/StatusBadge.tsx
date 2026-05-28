import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TripStatus } from '@vacationist/types';

const statusStyle: Record<TripStatus, { bg: string; text: string }> = {
  planning: { bg: 'bg-primary/10', text: 'text-primary' },
  active: { bg: 'bg-success/10', text: 'text-success' },
  completed: { bg: 'bg-border/50', text: 'text-text-muted' },
  archived: { bg: 'bg-border/20', text: 'text-text-muted' },
};

interface StatusBadgeProps {
  status: TripStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation('trips');
  const style = statusStyle[status];
  const labelKey = `status.${status}` as const;

  return (
    <View className={`px-sm py-xs rounded-full ${style.bg}`}>
      <Text className={`text-label ${style.text}`}>{t(labelKey)}</Text>
    </View>
  );
}
