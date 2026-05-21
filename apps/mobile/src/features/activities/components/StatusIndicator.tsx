import { View, Text } from 'react-native';

interface StatusIndicatorProps {
  status: string;
  votingOpen: boolean;
}

export function StatusIndicator({ status, votingOpen }: StatusIndicatorProps) {
  if (votingOpen) {
    return (
      <View className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-primary/10">
        <View className="w-[6px] h-[6px] rounded-full bg-primary" />
        <Text className="text-primary text-label font-medium">Voting</Text>
      </View>
    );
  }

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    planned: { bg: 'bg-primary/10', text: 'text-primary', label: 'Planned' },
    blocked: { bg: 'bg-danger/10', text: 'text-danger', label: 'Blocked' },
    reserved: { bg: 'bg-success/10', text: 'text-success', label: 'Reserved' },
    completed: { bg: 'bg-border/50', text: 'text-text-muted', label: 'Done' },
    skipped: { bg: 'bg-warning/10', text: 'text-warning', label: 'Skipped' },
  };

  const cfg = statusConfig[status] ?? statusConfig.planned;

  return (
    <View className={`px-sm py-xs rounded-full ${cfg.bg}`}>
      <Text className={`${cfg.text} text-label font-medium`}>{cfg.label}</Text>
    </View>
  );
}
