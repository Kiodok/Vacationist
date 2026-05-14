import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import type { Activity, ActivityVote, VoteType } from '@vacationist/types';
import { VoteChip, VoteSummary } from './VoteChip';

interface ActivityCardProps {
  activity: Activity;
  votes: ActivityVote[];
  currentUserId: string | undefined;
  onPress: () => void;
  onVotePress: () => void;
  detail?: React.ReactNode;
}

export function ActivityCard({ activity, votes, currentUserId, onPress, onVotePress, detail }: ActivityCardProps) {
  const myVote = votes.find((v) => v.user_id === currentUserId);
  const showBreakdown = !activity.voting_open;
  const borderColor = getVoteBorderColor(votes);

  return (
    <View
      className={`bg-surface border border-border ${detail ? 'rounded-t-md' : 'rounded-md'}`}
      style={borderColor ? { borderColor } : undefined}
    >
      <Pressable
        onPress={onPress}
        className="p-md gap-sm"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-xs">
          <Text className="text-body text-text-primary font-semibold" numberOfLines={1}>
            {activity.title}
          </Text>
          {activity.category && (
            <Text className="text-body-small text-text-secondary capitalize">
              {activity.category}
            </Text>
          )}
        </View>
        <StatusIndicator status={activity.status} votingOpen={activity.voting_open} />
      </View>

      {activity.description && (
        <Text className="text-body-small text-text-secondary" numberOfLines={2}>
          {activity.description}
        </Text>
      )}

      <View className="flex-row flex-wrap items-center gap-sm">
        {activity.activity_date && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="calendar-outline" size={14} color="#A0A0A0" />
            <Text className="text-body-small text-text-secondary">
              {dayjs(activity.activity_date).format('D MMM')}
            </Text>
          </View>
        )}
        {activity.start_time && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="time-outline" size={14} color="#A0A0A0" />
            <Text className="text-body-small text-text-secondary">
              {activity.start_time.slice(0, 5)}
              {activity.end_time ? ` – ${activity.end_time.slice(0, 5)}` : ''}
            </Text>
          </View>
        )}
        {activity.cost_estimate != null && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="wallet-outline" size={14} color="#A0A0A0" />
            <Text className="text-body-small text-text-secondary">
              €{activity.cost_estimate}
            </Text>
          </View>
        )}
      </View>

      {/* Vote section */}
      <View className="flex-row items-center justify-between mt-xs">
        <View className="flex-row items-center gap-sm">
          {votes.length > 0 && <VoteStats votes={votes} />}
          {showBreakdown ? (
            <VoteSummary votes={votes} />
          ) : myVote ? (
            <VoteChip vote={myVote.vote} size="sm" onPress={onVotePress} />
          ) : (
            <Pressable
              onPress={onVotePress}
              className="flex-row items-center gap-xs px-md py-sm rounded-full bg-primary/10"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="hand-left-outline" size={14} color="#6C63FF" />
              <Text className="text-primary text-body-small font-medium">Vote</Text>
            </Pressable>
          )}
        </View>
        <Text className="text-body-small text-text-muted">
          {votes.length} {votes.length === 1 ? 'vote' : 'votes'}
        </Text>
      </View>
      </Pressable>
      {detail}
    </View>
  );
}

const VOTE_SCORE: Record<VoteType, number> = {
  must_do: 5,
  like: 4,
  open: 3,
  skip: 2,
  group_blocker: 1,
};

function getVoteBorderColor(votes: { vote: VoteType }[]): string | undefined {
  if (votes.length === 0) return undefined;
  if (votes.some((v) => v.vote === 'group_blocker')) return '#FF5C5C';

  const avg = votes.reduce((sum, v) => sum + VOTE_SCORE[v.vote], 0) / votes.length;
  if (avg >= 4.0) return '#3ECF8E';
  if (avg >= 3.0) return undefined;
  return '#F5A623';
}

function VoteStats({ votes }: { votes: { vote: VoteType }[] }) {
  const scores = votes.map((v) => VOTE_SCORE[v.vote]).sort((a, b) => a - b);
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const mid = Math.floor(scores.length / 2);
  const median =
    scores.length % 2 !== 0
      ? scores[mid]
      : (scores[mid - 1] + scores[mid]) / 2;

  return (
    <View className="flex-row items-center gap-xs">
      <Text className="text-label text-text-muted">Avg {avg.toFixed(1)}</Text>
      <Text className="text-label text-text-muted">·</Text>
      <Text className="text-label text-text-muted">Med {median.toFixed(1)}</Text>
    </View>
  );
}

function StatusIndicator({ status, votingOpen }: { status: string; votingOpen: boolean }) {
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
