import { useState, useMemo } from 'react';
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Activity, SupportedTimezone, VoteType } from '@vacationist/types';
import { formatActivityTime, dayjs } from '@vacationist/utils';
import { StatusIndicator } from '../../activities/components/StatusIndicator';
import { VoteSummary } from '../../activities/components/VoteChip';
import { useActivityVotes } from '../../activities/hooks/useVotes';
import { useTripMembers } from '../../trips/hooks/useMembers';
import { colors, METADATA_ICON_COLORS , ThemedIcon } from '@vacationist/ui';
import type { IoniconsName } from '@vacationist/ui';

interface CalendarActivitySheetProps {
  visible: boolean;
  onClose: () => void;
  activity: Activity | null;
  timezone: SupportedTimezone;
  onViewFullDetails: (activityId: string) => void;
  onEdit?: (activity: Activity) => void;
}

export function CalendarActivitySheet({
  visible,
  onClose,
  activity,
  timezone,
  onViewFullDetails,
  onEdit,
}: CalendarActivitySheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('calendar');
  const { data: votes, isLoading: votesLoading } = useActivityVotes(activity?.id ?? '');
  const { data: members } = useTripMembers(activity?.trip_id ?? '');
  const [showVotes, setShowVotes] = useState(false);

  const { attendees, voterDetails } = useMemo(() => {
    if (!members) return { attendees: [], voterDetails: [] };
    const memberMap = new Map(members.map((m) => [m.user_id, m.user.name]));
    const voterIds = new Set((votes ?? []).map((v) => v.user_id));
    const skipUserIds = new Set(
      (votes ?? []).filter((v) => v.vote === 'skip').map((v) => v.user_id),
    );
    const attending = members
      .filter((m) => voterIds.has(m.user_id) && !skipUserIds.has(m.user_id))
      .map((m) => m.user.name);
    const details = (votes ?? []).map((v) => ({
      name: memberMap.get(v.user_id) ?? 'Unknown',
      vote: v.vote,
    }));
    return { attendees: attending, voterDetails: details };
  }, [votes, members]);

  const hasBlocker = votes?.some((v) => v.vote === 'group_blocker');
  const displayStatus = hasBlocker && !activity?.voting_open ? 'blocked' : activity?.status;

  if (!activity) return null;

  const timeLabel = formatActivityTime(activity.start_time, activity.end_time, t('allDay'));

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
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          {/* Handle bar */}
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          {/* Time and status */}
          <View className="flex-row items-center justify-between mb-sm">
            <View className="flex-row items-center gap-xs">
              <ThemedIcon name="time-outline" size={16} color={METADATA_ICON_COLORS.time.color} />
              <Text className="text-body text-text-secondary">{timeLabel}</Text>
            </View>
            <StatusIndicator status={displayStatus ?? activity.status} votingOpen={activity.voting_open} />
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
              <ThemedIcon name="calendar-outline" size={14} color={METADATA_ICON_COLORS.calendar.color} />
              <Text className="text-body-small text-text-secondary">
                {dayjs.tz(activity.activity_date, timezone).format('dddd, D MMMM YYYY')}
              </Text>
            </View>
          ) : null}

          {/* Description */}
          {activity.description ? (
            <Text className="text-body-small text-text-secondary mb-sm">
              {activity.description}
            </Text>
          ) : null}

          {/* Attendees */}
          {attendees.length > 0 && (
            <View className="mb-md">
              <View className="flex-row items-center gap-xs mb-sm">
                <ThemedIcon name="people" size={16} color={colors.primary} />
                <Text className="text-primary text-body-small font-semibold">
                  {t('attendeeCount', { count: attendees.length })}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-xs">
                {attendees.map((name, i) => (
                  <View key={i} className="bg-primary/10 rounded-full px-sm py-xs">
                    <Text className="text-primary text-body-small font-medium">{name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Vote summary (collapsible) */}
          <View className="mb-md">
            {votesLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : votes && votes.length > 0 ? (
              <View>
                <Pressable
                  onPress={() => setShowVotes(!showVotes)}
                  className="flex-row items-center gap-xs"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <VoteSummary votes={votes} />
                  <Text className="text-body-small text-text-muted ml-xs">
                    {t('voteCount', { count: votes.length })}
                  </Text>
                  <ThemedIcon
                    name={showVotes ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={METADATA_ICON_COLORS.chevron.color}
                  />
                </Pressable>
                {showVotes && (
                  <ScrollView className="mt-sm" style={{ maxHeight: 140 }}>
                    {voterDetails.map((v, i) => (
                      <View key={i} className="flex-row items-center gap-sm py-xs">
                        <VoteIcon vote={v.vote} />
                        <Text className="text-body-small text-text-primary">{v.name}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            ) : (
              <Text className="text-body-small text-text-muted">{t('noVotes')}</Text>
            )}
          </View>

          {/* Action buttons */}
          <View className="flex-row gap-sm">
            {onEdit && (
              <Pressable
                onPress={() => onEdit(activity)}
                className="bg-primary/10 rounded-md py-md items-center justify-center px-md"
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <ThemedIcon name="create-outline" size={20} color={colors.primary} />
              </Pressable>
            )}
            <Pressable
              onPress={() => onViewFullDetails(activity.id)}
              className="bg-primary rounded-md py-md items-center flex-1"
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Text className="text-white text-body font-semibold">{t('viewFullDetails')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const VOTE_ICONS: Record<VoteType, { name: IoniconsName; color: string }> = {
  must_do: { name: 'heart', color: colors.danger },
  like: { name: 'thumbs-up', color: colors.success },
  open: { name: 'remove-outline', color: colors.textSecondary },
  skip: { name: 'thumbs-down', color: colors.warning },
  group_blocker: { name: 'chatbubbles', color: colors.danger },
};

function VoteIcon({ vote }: { vote: VoteType }) {
  const config = VOTE_ICONS[vote];
  return <ThemedIcon name={config.name} size={14} color={config.color} />;
}
