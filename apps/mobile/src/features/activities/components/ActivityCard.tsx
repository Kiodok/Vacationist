import { View, Text, Pressable, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dayjs } from '@vacationist/utils';
import type { Activity, ActivityVote, VoteType } from '@vacationist/types';
import { VoteChip, VoteSummary } from './VoteChip';
import { StatusIndicator } from './StatusIndicator';
import { colors, CATEGORY_ICON_COLORS, METADATA_ICON_COLORS } from '@vacationist/ui';
import { useHighlightAnimation } from '../../../hooks/useHighlightAnimation';

interface ActivityCardProps {
  activity: Activity;
  votes: ActivityVote[];
  currentUserId: string | undefined;
  onPress: () => void;
  onVotePress: () => void;
  detail?: React.ReactNode;
  displayStatus?: string;
  highlight?: boolean;
}

export function ActivityCard({ activity, votes, currentUserId, onPress, onVotePress, detail, displayStatus, highlight }: ActivityCardProps) {
  const { t } = useTranslation('activities');
  const myVote = votes.find((v) => v.user_id === currentUserId);
  const showBreakdown = !activity.voting_open;
  const borderColor = getVoteBorderColor(votes);

  const { animatedBorderColor } = useHighlightAnimation(highlight, borderColor);
  const categoryIcon = activity.category ? CATEGORY_ICON_COLORS[activity.category] : null;

  return (
    <Animated.View
      className={`bg-surface ${detail ? 'rounded-t-md' : 'rounded-md'}`}
      style={{ borderWidth: 1, borderColor: animatedBorderColor, ...(Platform.OS === 'web' ? { borderStyle: 'solid' as const } : {}) }}
    >
      <Pressable
        onPress={onPress}
        className="p-md gap-sm"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-xs">
          <Text className="text-body text-text-primary font-semibold" numberOfLines={2}>
            {activity.title}
          </Text>
          {activity.category ? (
            <View className="flex-row items-center gap-xs">
              {categoryIcon ? <Ionicons name={categoryIcon.icon} size={12} color={categoryIcon.color} /> : null}
              <Text className="text-body-small text-text-secondary">
                {t(`category.${activity.category}`, { defaultValue: activity.category })}
              </Text>
            </View>
          ) : null}
        </View>
        <StatusIndicator status={displayStatus ?? activity.status} votingOpen={activity.voting_open} />
      </View>

      {activity.description ? (
        <Text className="text-body-small text-text-secondary" numberOfLines={2}>
          {activity.description}
        </Text>
      ) : null}

      <View className="flex-row flex-wrap items-center gap-sm">
        {activity.activity_date ? (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="calendar-outline" size={14} color={METADATA_ICON_COLORS.calendar.color} />
            <Text className="text-body-small text-text-secondary">
              {dayjs(activity.activity_date).format('ddd, D MMM')}
            </Text>
          </View>
        ) : null}
        {activity.start_time ? (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="time-outline" size={14} color={METADATA_ICON_COLORS.time.color} />
            <Text className="text-body-small text-text-secondary">
              {activity.start_time.slice(0, 5)}
              {activity.end_time ? ` – ${activity.end_time.slice(0, 5)}` : ''}
            </Text>
          </View>
        ) : null}
        {activity.cost_estimate != null && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="wallet-outline" size={14} color={METADATA_ICON_COLORS.cost.color} />
            <Text className="text-body-small text-text-secondary">
              €{activity.cost_estimate}
            </Text>
          </View>
        )}
        {activity.reservation_required && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="ticket-outline" size={14} color={colors.warning} />
            <Text className="text-body-small" style={{ color: colors.warning }}>
              {t('field.reservationRequired')}
            </Text>
          </View>
        )}
      </View>

      {/* Vote section */}
      <View className="mt-xs gap-xs">
        <View className="flex-row items-center gap-sm">
          {votes.length > 0 && <VoteSummary votes={votes} />}
          {showBreakdown ? null : myVote ? (
            <VoteChip vote={myVote.vote} size="sm" onPress={onVotePress} />
          ) : (
            <Pressable
              onPress={onVotePress}
              className="flex-row items-center gap-xs px-md py-sm rounded-full bg-primary/10"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Ionicons name="hand-left-outline" size={14} color={colors.primary} />
              <Text className="text-primary text-body-small font-medium">{t('vote.button')}</Text>
            </Pressable>
          )}
        </View>
        {votes.length > 0 && (
          <Pressable
            onPress={onVotePress}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-body-small text-text-primary">
              {t('vote.showCount', { count: votes.length })}
            </Text>
          </Pressable>
        )}
      </View>
      </Pressable>
      {detail}
    </Animated.View>
  );
}

const VOTE_SCORE: Record<VoteType, number> = {
  must_do: 5,
  like: 4,
  open: 3,
  skip: 2,
  group_blocker: 1,
};

function getVoteBorderColor(votes: { vote: VoteType }[]): string {
  if (votes.length === 0) return colors.border;
  if (votes.some((v) => v.vote === 'group_blocker')) return colors.danger;

  const avg = votes.reduce((sum, v) => sum + VOTE_SCORE[v.vote], 0) / votes.length;
  if (avg >= 4.0) return colors.success;
  if (avg >= 3.0) return colors.border;
  return colors.warning;
}


