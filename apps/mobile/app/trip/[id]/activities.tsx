import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, TouchableOpacity, SectionList, Linking, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import type { Activity, VoteType, CreateActivityInput, UpdateActivityInput } from '@vacationist/types';
import { useActivities, useCreateActivity, useUpdateActivity, useDeleteActivity, useCloseVoting, useReopenVoting } from '../../../src/features/activities/hooks/useActivities';
import { useActivityVotes, useCastVote, useRemoveVote, useActivityVotesBatch } from '../../../src/features/activities/hooks/useVotes';
import { useActivityVotesRealtime } from '../../../src/features/activities/hooks/useActivityVotesRealtime';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useCurrentMemberRole, useTripMembers } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { ActivityCard } from '../../../src/features/activities/components/ActivityCard';
import { VoteSheet } from '../../../src/features/activities/components/VoteSheet';
import { CreateActivitySheet } from '../../../src/features/activities/components/CreateActivitySheet';
import { EditActivitySheet } from '../../../src/features/activities/components/EditActivitySheet';
import { EmptyActivities } from '../../../src/features/activities/components/EmptyActivities';
import { ActivityListSkeleton } from '../../../src/features/activities/components/ActivityListSkeleton';
import { colors } from '@vacationist/ui';

function isAutoCompleted(activity: Activity): boolean {
  if (!activity.activity_date) return false;
  const now = dayjs();
  const date = activity.activity_date;
  if (activity.end_time) {
    return now.isAfter(dayjs(`${date}T${activity.end_time}`));
  }
  if (activity.start_time) {
    return now.isAfter(dayjs(`${date}T${activity.start_time}`).add(2, 'hour'));
  }
  return now.isAfter(dayjs(date).endOf('day'));
}

function isOngoing(activity: Activity): boolean {
  if (!activity.activity_date) return false;
  const now = dayjs();
  const date = activity.activity_date;
  if (activity.start_time && activity.end_time) {
    const start = dayjs(`${date}T${activity.start_time}`);
    const end = dayjs(`${date}T${activity.end_time}`);
    return now.isAfter(start) && now.isBefore(end);
  }
  if (activity.start_time) {
    const start = dayjs(`${date}T${activity.start_time}`);
    return now.isAfter(start) && now.isBefore(start.add(2, 'hour'));
  }
  return dayjs(date).isSame(now, 'day');
}

function sortByDate(a: Activity, b: Activity): number {
  const dateA = a.activity_date ?? '';
  const dateB = b.activity_date ?? '';
  if (dateA === dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  return dateA < dateB ? -1 : 1;
}

export default function ActivitiesTab() {
  const { id: tripId, activityId } = useLocalSearchParams<{ id: string; activityId?: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: trip } = useTrip(tripId!);
  const { data: activities, isLoading, isFetching, refetch } = useActivities(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const allActivityIds = useMemo(() => (activities ?? []).map((a) => a.id), [activities]);
  const { data: allVotes } = useActivityVotesBatch(allActivityIds);
  const blockedActivityIds = useMemo(() => {
    if (!allVotes) return new Set<string>();
    const blocked = new Set<string>();
    for (const v of allVotes) {
      if (v.vote === 'group_blocker') blocked.add(v.activity_id);
    }
    return blocked;
  }, [allVotes]);
  const createActivity = useCreateActivity();
  const updateActivityMutation = useUpdateActivity(tripId!);
  const deleteActivity = useDeleteActivity(tripId!);
  const closeVoting = useCloseVoting(tripId!);
  const reopenVoting = useReopenVoting(tripId!);
  useActivityVotesRealtime(tripId!);

  const [showCreate, setShowCreate] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const { inPlanningList, plannedList, blockedList, ongoingList, completedList } = useMemo(() => {
    const inPlanning: Activity[] = [];
    const planned: Activity[] = [];
    const blocked: Activity[] = [];
    const ongoing: Activity[] = [];
    const completed: Activity[] = [];
    for (const a of activities ?? []) {
      if (a.status === 'completed' || a.status === 'skipped') {
        completed.push(a);
      } else if (isAutoCompleted(a)) {
        completed.push(a);
      } else if (isOngoing(a)) {
        ongoing.push(a);
      } else if (a.voting_open) {
        inPlanning.push(a);
      } else if (blockedActivityIds.has(a.id)) {
        blocked.push(a);
      } else {
        planned.push(a);
      }
    }
    inPlanning.sort(sortByDate);
    planned.sort(sortByDate);
    blocked.sort(sortByDate);
    ongoing.sort(sortByDate);
    completed.sort(sortByDate);
    return { inPlanningList: inPlanning, plannedList: planned, blockedList: blocked, ongoingList: ongoing, completedList: completed };
  }, [activities, blockedActivityIds]);

  const sections = useMemo(() => {
    const result: { key: string; title: string; data: Activity[] }[] = [];
    if (ongoingList.length > 0) {
      result.push({ key: 'ongoing', title: 'Ongoing', data: ongoingList });
    }
    if (inPlanningList.length > 0) {
      result.push({ key: 'in_planning', title: 'In Planning', data: inPlanningList });
    }
    if (plannedList.length > 0) {
      result.push({ key: 'planned', title: 'Planned', data: plannedList });
    }
    if (blockedList.length > 0) {
      result.push({ key: 'blocked', title: 'Blocked', data: blockedList });
    }
    if (completedList.length > 0) {
      result.push({ key: 'completed', title: 'Completed', data: completedList });
    }
    return result;
  }, [ongoingList, inPlanningList, plannedList, blockedList, completedList]);

  const sectionListRef = useRef<SectionList>(null);

  useEffect(() => {
    if (!activityId || sections.length === 0) return;
    const timer = setTimeout(() => {
      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
        const itemIndex = sections[sectionIndex].data.findIndex((a) => a.id === activityId);
        if (itemIndex >= 0) {
          sectionListRef.current?.scrollToLocation({ sectionIndex, itemIndex, animated: true, viewOffset: 80 });
          break;
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [activityId, sections]);

  const handleCreate = (input: CreateActivityInput) => {
    setShowCreate(false);
    createActivity.mutate({ tripId: tripId!, input });
  };

  const handleUpdate = (input: UpdateActivityInput) => {
    if (!editingActivity) return;
    updateActivityMutation.mutate(
      { activityId: editingActivity.id, input },
      { onSuccess: () => setEditingActivity(null) },
    );
  };

  if (isLoading) {
    return <ActivityListSkeleton />;
  }

  const isEmpty = !activities || activities.length === 0;

  return (
    <View className="flex-1">
      {isEmpty ? (
        <View className="flex-1 px-md py-md">
          <EmptyActivities />
        </View>
      ) : (
        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={false}
          stickySectionHeadersEnabled={false}
          windowSize={5}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
          contentContainerClassName="px-md py-md"
          renderSectionHeader={({ section }) => {
            const config: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; textClass: string }> = {
              ongoing: { icon: 'play-circle-outline', color: colors.warning, textClass: 'text-warning' },
              in_planning: { icon: 'compass-outline', color: colors.primary, textClass: 'text-primary' },
              planned: { icon: 'calendar-outline', color: colors.textPrimary, textClass: 'text-text-primary' },
              blocked: { icon: 'ban-outline', color: colors.danger, textClass: 'text-danger' },
              completed: { icon: 'checkmark-done-outline', color: colors.success, textClass: 'text-success' },
            };
            const cfg = config[section.key ?? 'planned'] ?? config.planned;
            return (
              <View className="flex-row items-center gap-xs pt-md pb-sm px-xs">
                <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                <Text className={`text-body font-semibold ${cfg.textClass}`}>
                  {section.title}
                </Text>
                <Text className="text-body-small text-text-muted">
                  ({section.data.length})
                </Text>
              </View>
            );
          }}
          renderItem={({ item }) => (
            <View className="mb-sm">
              <ActivityCardWithVotes
                activity={item}
                tripId={tripId!}
                currentUserId={user?.id}
                role={role}
                initialExpanded={item.id === activityId}
                isBlocked={blockedActivityIds.has(item.id)}
                onEdit={() => setEditingActivity(item)}
                onDelete={() => deleteActivity.mutate(item.id)}
                onCloseVoting={() => closeVoting.mutate(item.id)}
                onReopenVoting={() => reopenVoting.mutate(item.id)}
              />
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => setShowCreate(true)}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <CreateActivitySheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={createActivity.isPending}
        tripStartDate={trip?.start_date ?? ''}
        tripEndDate={trip?.end_date ?? ''}
      />

      {editingActivity && (
        <EditActivitySheet
          visible={!!editingActivity}
          onClose={() => setEditingActivity(null)}
          onSubmit={handleUpdate}
          isPending={updateActivityMutation.isPending}
          activity={editingActivity}
          tripStartDate={trip?.start_date ?? ''}
          tripEndDate={trip?.end_date ?? ''}
        />
      )}
    </View>
  );
}

function ActivityCardWithVotes({
  activity,
  tripId,
  currentUserId,
  role,
  initialExpanded,
  isBlocked,
  onEdit,
  onDelete,
  onCloseVoting,
  onReopenVoting,
}: {
  activity: Activity;
  tripId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  initialExpanded?: boolean;
  isBlocked: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCloseVoting: () => void;
  onReopenVoting: () => void;
}) {
  const { data: votes = [] } = useActivityVotes(activity.id);
  const { data: members } = useTripMembers(tripId);
  const castVote = useCastVote();
  const removeVote = useRemoveVote(tripId, activity.id);
  const [showVoteSheet, setShowVoteSheet] = useState(false);
  const [showDetail, setShowDetail] = useState(initialExpanded ?? false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCloseVoting, setConfirmingCloseVoting] = useState(false);

  const memberMap = useMemo(
    () => new Map((members ?? []).map((m) => [m.user_id, m.user.name])),
    [members],
  );

  const canEdit =
    role === 'organizer' ||
    (role === 'participant' && activity.created_by === currentUserId);
  const canDelete =
    role === 'organizer' ||
    (role === 'participant' && activity.created_by === currentUserId);
  const canCloseVoting = role === 'organizer' && activity.voting_open;
  const canReopenVoting = role === 'organizer' && !activity.voting_open;

  const handleCastVote = (vote: VoteType) => {
    castVote.mutate({ vote, activityId: activity.id, tripId }, { onSuccess: () => setShowVoteSheet(false) });
  };

  const handleRemoveVote = () => {
    removeVote.mutate(undefined, { onSuccess: () => setShowVoteSheet(false) });
  };

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      {activity.description && (
        <View className="gap-xs">
          <Text className="text-label text-text-muted uppercase">Description</Text>
          <Text className="text-body-small text-text-secondary">{activity.description}</Text>
        </View>
      )}
      {activity.external_url && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL(activity.external_url!)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Ionicons name="link-outline" size={14} color={colors.primary} />
          <Text className="text-primary text-body-small underline" numberOfLines={1}>
            {activity.external_url}
          </Text>
        </TouchableOpacity>
      )}
      {activity.maps_url && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL(activity.maps_url!)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Ionicons name="map-outline" size={14} color={colors.primary} />
          <Text className="text-primary text-body-small underline" numberOfLines={1}>
            {activity.maps_url}
          </Text>
        </TouchableOpacity>
      )}

      <View className="gap-sm mt-xs">
        {confirmingCloseVoting ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text className="text-text-secondary text-body-small">Close voting?</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onCloseVoting(); setConfirmingCloseVoting(false); }}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(245, 166, 35, 0.2)' }}
            >
              <Text className="text-warning text-body-small font-semibold">Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingCloseVoting(false)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
            >
              <Text className="text-text-secondary text-body-small">Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : confirmingDelete ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text className="text-text-secondary text-body-small">Delete this activity?</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onDelete(); setConfirmingDelete(false); }}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(255, 92, 92, 0.2)' }}
            >
              <Text className="text-danger text-body-small font-semibold">Yes, delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingDelete(false)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
            >
              <Text className="text-text-secondary text-body-small">Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {canEdit && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onEdit}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(108, 99, 255, 0.1)' }}
              >
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">Edit</Text>
              </TouchableOpacity>
            )}
            {canCloseVoting && votes.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingCloseVoting(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(245, 166, 35, 0.1)' }}
              >
                <Ionicons name="lock-closed-outline" size={14} color={colors.warning} />
                <Text className="text-warning text-body-small font-medium">End voting</Text>
              </TouchableOpacity>
            )}
            {canReopenVoting && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onReopenVoting}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(108, 99, 255, 0.1)' }}
              >
                <Ionicons name="lock-open-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">Re-open voting</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingDelete(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(255, 92, 92, 0.1)' }}
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text className="text-danger text-body-small font-medium">Delete activity</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  ) : undefined;

  return (
    <>
      <ActivityCard
        activity={activity}
        votes={votes}
        currentUserId={currentUserId}
        onPress={() => setShowDetail(!showDetail)}
        onVotePress={() => setShowVoteSheet(true)}
        detail={detailContent}
        displayStatus={isBlocked ? 'blocked' : undefined}
        highlight={initialExpanded}
      />

      <VoteSheet
        visible={showVoteSheet}
        onClose={() => setShowVoteSheet(false)}
        votes={votes}
        currentUserId={currentUserId}
        votingOpen={activity.voting_open}
        onCastVote={handleCastVote}
        onRemoveVote={handleRemoveVote}
        isPending={castVote.isPending}
        memberMap={memberMap}
      />
    </>
  );
}
