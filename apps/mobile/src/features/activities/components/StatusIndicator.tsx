import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

interface StatusIndicatorProps {
  status: string;
  votingOpen: boolean;
}

export function StatusIndicator({ status, votingOpen }: StatusIndicatorProps) {
  const { t } = useTranslation('activities');

  if (votingOpen) {
    return (
      <View className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-primary/10">
        <View className="w-[6px] h-[6px] rounded-full bg-primary" />
        <Text className="text-primary text-label font-medium">{t('status.voting')}</Text>
      </View>
    );
  }

  const statusConfig: Record<string, { bg: string; text: string }> = {
    planned:   { bg: 'bg-primary/10',  text: 'text-primary' },
    blocked:   { bg: 'bg-danger/10',   text: 'text-danger' },
    reserved:  { bg: 'bg-success/10',  text: 'text-success' },
    completed: { bg: 'bg-border/50',   text: 'text-text-muted' },
    skipped:   { bg: 'bg-warning/10',  text: 'text-warning' },
  };

  const cfg = statusConfig[status] ?? statusConfig.planned;

  return (
    <View className={`px-sm py-xs rounded-full ${cfg.bg}`}>
      <Text className={`${cfg.text} text-label font-medium`}>{t(`status.${status}`, { defaultValue: status })}</Text>
    </View>
  );
}
