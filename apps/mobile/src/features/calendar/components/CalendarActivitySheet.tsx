import { useState, useMemo } from 'react';
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Activity, SupportedTimezone, VoteType } from '@vacationist/types';
import { formatActivityTime, dayjs } from '@vacationist/utils';
import { StatusIndicator } from '../../activities/components/StatusIndicator';
import { VoteSummary } from '../../activities/components/VoteChip';
import { useActivityVotes } from '../../activities/hooks/useVotes';
import { useTripMembers } from '../../trips/hooks/useMembers';

interface CalendarActivitySheetProps {
  visible: boolean;
  onClose: () => void;
  activity: Activity | null;
  timezone: SupportedTimezone;
  onViewFullDetails: (activityId: string) => void;
}

export function CalendarActivitySheet({
  visible,
  onClose,
  activity,
  timezone,
  onViewFullDetails,
}: CalendarActivitySheetProps) {
  const { data: votes, isLoading: votesLoading } = useActivityVotes(activity?.id ?? '');
  const { data: members } = useTripMembers(activity?.trip_id ?? '');
  const [showVoters, setShowVoters] = useState(false);

  const voterNames = useMemo(() => {
    if (!votes || !members) return [];
    const memberMap = new Map(members.map((m) => [m.user_id, m.user.name]));
    return votes.map((v) => ({ name: memberMap.get(v.user_id) ?? 'Unknown', vote: v.vote }));
  }, [votes, members]);

  if (!activity) return null;

  const timeLabel = formatActivityTime(activity.start_time, activity.end_time);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-background/80"
          onPress={onClose}
        />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl">
          {/* Handle bar */}
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          {/* Time and status */}
          <View className="flex-row items-center justify-between mb-sm">
            <View className="flex-row items-center gap-xs">
              <Ionicons name="time-outline" size={16} color="#A0A0A0" />
              <Text className="text-body text-text-secondary">{timeLabel}</Text>
            </View>
            <StatusIndicator status={activity.status} votingOpen={activity.voting_open} />
          </View>

          {/* Title */}
          <Text className="text-heading-m text-text-primary mb-xs">{activity.title}</Text>

          {/* Category */}
          {activity.category ? (
            <Text className="text-body-small text-text-secondary capitalize mb-sm">
              {activity.category}
            </Text>
          ) : null}

          {/* Date */}
          {activity.activity_date ? (
            <View className="flex-row items-center gap-xs mb-sm">
              <Ionicons name="calendar-outline" size={14} color="#A0A0A0" />
              <Text className="text-body-small text-text-secondary">
                {dayjs.tz(activity.activity_date, timezone).format('dddd, D MMMM YYYY')}
              </Text>
            </View>
          ) : null}

          {/* Description */}
          {activity.description ? (
            <Text className="text-body-small text-text-secondary mb-sm" numberOfLines={3}>
              {activity.description}
            </Text>
          ) : null}

          {/* Vote summary */}
          <View className="mb-md">
            {votesLoading ? (
              <ActivityIndicator size="small" color="#6C63FF" />
            ) : votes && votes.length > 0 ? (
              <View className="flex-row items-center gap-sm">
                <VoteSummary votes={votes} />
                <Text className="text-body-small text-text-muted">
                  {votes.length} {votes.length === 1 ? 'vote' : 'votes'}
                </Text>
              </View>
            ) : (
              <Text className="text-body-small text-text-muted">No votes yet</Text>
            )}
          </View>

          {/* Voters */}
          {voterNames.length > 0 && (
            <View className="mb-md">
              <Pressable
                onPress={() => setShowVoters(!showVoters)}
                className="flex-row items-center gap-xs"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Ionicons name="people-outline" size={16} color="#6C63FF" />
                <Text className="text-primary text-body-small font-medium">
                  {voterNames.length} {voterNames.length === 1 ? 'voter' : 'voters'}
                </Text>
                <Ionicons
                  name={showVoters ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#6C63FF"
                />
              </Pressable>
              {showVoters && (
                <ScrollView
                  className="mt-sm"
                  style={{ maxHeight: 160 }}
                >
                  {voterNames.map((v, i) => (
                    <View key={i} className="flex-row items-center gap-sm py-xs">
                      <VoteIcon vote={v.vote} />
                      <Text className="text-body-small text-text-primary">{v.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* View full details button */}
          <Pressable
            onPress={() => onViewFullDetails(activity.id)}
            className="bg-primary rounded-md py-md items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Text className="text-white text-body font-semibold">View full details</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const VOTE_ICONS: Record<VoteType, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  must_do: { name: 'heart', color: '#FF5C5C' },
  like: { name: 'thumbs-up', color: '#3ECF8E' },
  open: { name: 'remove-outline', color: '#A0A0A0' },
  skip: { name: 'thumbs-down', color: '#F5A623' },
  group_blocker: { name: 'ban', color: '#FF5C5C' },
};

function VoteIcon({ vote }: { vote: VoteType }) {
  const config = VOTE_ICONS[vote];
  return <Ionicons name={config.name} size={14} color={config.color} />;
}
