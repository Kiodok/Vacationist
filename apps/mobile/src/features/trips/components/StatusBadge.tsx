import { View, Text } from 'react-native';
import type { TripStatus } from '@vacationist/types';

const statusConfig: Record<TripStatus, { bg: string; text: string; label: string }> = {
  planning: { bg: 'bg-primary/10', text: 'text-primary', label: 'Planning' },
  active: { bg: 'bg-success/10', text: 'text-success', label: 'Active' },
  completed: { bg: 'bg-border/50', text: 'text-text-muted', label: 'Completed' },
  archived: { bg: 'bg-border/20', text: 'text-text-muted', label: 'Archived' },
};

interface StatusBadgeProps {
  status: TripStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <View className={`px-sm py-xs rounded-full ${config.bg}`}>
      <Text className={`text-label ${config.text}`}>{config.label}</Text>
    </View>
  );
}
