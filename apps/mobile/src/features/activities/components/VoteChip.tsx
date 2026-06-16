import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { VoteType } from '@vacationist/types';

const VOTE_CONFIG: Record<VoteType, { icon: string; bg: string; text: string }> = {
  must_do: { icon: '⭐', bg: 'bg-success/20', text: 'text-success' },
  like: { icon: '👍', bg: 'bg-primary/20', text: 'text-primary' },
  open: { icon: '🤷', bg: 'bg-border/50', text: 'text-text-secondary' },
  skip: { icon: '➡️', bg: 'bg-warning/20', text: 'text-warning' },
  group_blocker: { icon: '💬', bg: 'bg-primary/20', text: 'text-primary' },
};

interface VoteChipProps {
  vote: VoteType;
  selected?: boolean;
  onPress?: () => void;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function VoteChip({ vote, selected, onPress, showLabel = true, size = 'md' }: VoteChipProps) {
  const { t } = useTranslation('activities');
  const config = VOTE_CONFIG[vote];
  const isSmall = size === 'sm';
  const className = `flex-row items-center gap-xs rounded-full ${config.bg} ${
    isSmall ? 'px-sm py-xs' : 'px-md py-sm'
  } ${selected ? 'border-2 border-primary' : ''}`;

  const content = (
    <>
      <Text className={isSmall ? 'text-body-small' : 'text-body'}>{config.icon}</Text>
      {showLabel && (
        <Text className={`${config.text} font-medium ${isSmall ? 'text-body-small' : 'text-body'}`}>
          {t(`voteType.${vote}`)}
        </Text>
      )}
    </>
  );

  if (!onPress) {
    return <View className={className}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      className={className}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}

interface VoteSummaryProps {
  votes: { vote: VoteType }[];
}

export function VoteSummary({ votes }: VoteSummaryProps) {
  const counts = votes.reduce<Partial<Record<VoteType, number>>>((acc, v) => {
    acc[v.vote] = (acc[v.vote] ?? 0) + 1;
    return acc;
  }, {});

  const ordered: VoteType[] = ['must_do', 'like', 'open', 'skip', 'group_blocker'];

  return (
    <View className="flex-row flex-wrap gap-xs">
      {ordered.map((voteType) => {
        const count = counts[voteType];
        if (!count) return null;
        const config = VOTE_CONFIG[voteType];
        return (
          <View
            key={voteType}
            className={`flex-row items-center gap-xs rounded-full px-sm py-xs ${config.bg}`}
          >
            <Text className="text-body-small">{config.icon}</Text>
            <Text className={`${config.text} text-body-small font-medium`}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}
