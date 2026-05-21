import { useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import type { Activity, ActivityVote, VoteType } from '@vacationist/types';
import { VoteChip, VoteSummary } from './VoteChip';
import { StatusIndicator } from './StatusIndicator';

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
  const myVote = votes.find((v) => v.user_id === currentUserId);
  const showBreakdown = !activity.voting_open;
  const borderColor = getVoteBorderColor(votes);

  const highlightAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (highlight) {
      const timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
        ]).start();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [highlight]);

  const animatedBorderColor = highlight
    ? highlightAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [borderColor, '#6C63FF'],
      })
    : borderColor;

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
          <Text className="text-body text-text-primary font-semibold" numberOfLines={1}>
            {activity.title}
          </Text>
          {activity.category ? (
            <Text className="text-body-small text-text-secondary capitalize">
              {activity.category}
            </Text>
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
            <Ionicons name="calendar-outline" size={14} color="#A0A0A0" />
            <Text className="text-body-small text-text-secondary">
              {dayjs(activity.activity_date).format('ddd, D MMM')}
            </Text>
          </View>
        ) : null}
        {activity.start_time ? (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="time-outline" size={14} color="#A0A0A0" />
            <Text className="text-body-small text-text-secondary">
              {activity.start_time.slice(0, 5)}
              {activity.end_time ? ` – ${activity.end_time.slice(0, 5)}` : ''}
            </Text>
          </View>
        ) : null}
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
          {votes.length > 0 && <VoteSummary votes={votes} />}
          {showBreakdown ? null : myVote ? (
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
  if (votes.length === 0) return '#555555';
  if (votes.some((v) => v.vote === 'group_blocker')) return '#FF5C5C';

  const avg = votes.reduce((sum, v) => sum + VOTE_SCORE[v.vote], 0) / votes.length;
  if (avg >= 4.0) return '#3ECF8E';
  if (avg >= 3.0) return '#555555';
  return '#F5A623';
}


