import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, TouchableOpacity, SectionList, Linking, RefreshControl, Switch, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useCollapsibleSections } from '../../../src/hooks/useCollapsibleSections';
import { CollapsibleSectionHeader } from '../../../src/components/CollapsibleSectionHeader';
import { dayjs } from '@vacationist/utils';
import type { Activity, VoteType, CreateActivityInput, UpdateActivityInput, Currency } from '@vacationist/types';
import { useActivities, useAllActivities, useCreateActivity, useUpdateActivity, useDeleteActivity, useCloseVoting, useReopenVoting } from '../../../src/features/activities/hooks/useActivities';
import { useActivityVotes, useCastVote, useRemoveVote, useTripActivityVotes } from '../../../src/features/activities/hooks/useVotes';
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
import { ActivityNotesSection } from '../../../src/features/activities/components/ActivityNotesSection';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import type { IoniconsName } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';
import { getQueryDisplayState } from '../../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../src/components/OfflineEmptyState';
import { SearchInput } from '../../../src/components/SearchInput';
import { flattenActivities, type ActivitiesData } from '../../../src/features/activities/utils/activityCache';
import { compareActivitiesForDisplay } from '../../../src/features/activities/utils/activityOrder';

function isTripLocked(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  const diffMs = Date.now() - new Date(endDate + 'T00:00:00').getTime();
  return diffMs > 14 * 24 * 60 * 60 * 1000;
}

const ACTIVITY_SECTION_CONFIG: Record<string, { icon: IoniconsName; iconColor: string; textClass: string }> = {
  ongoing:     { icon: 'play-circle-outline',    iconColor: colors.success,     textClass: 'text-success' },
  in_planning: { icon: 'compass-outline',        iconColor: colors.primary,     textClass: 'text-primary' },
  planned:     { icon: 'calendar-outline',       iconColor: colors.textPrimary, textClass: 'text-text-primary' },
  blocked:     { icon: 'chatbubbles-outline',     iconColor: colors.danger,      textClass: 'text-danger' },
  completed:   { icon: 'checkmark-done-outline', iconColor: colors.success,     textClass: 'text-success' },
};

function isAutoCompleted(activity: Activity, timezone: string): boolean {
  if (!activity.activity_date) return false;
  const now = dayjs();
  const date = activity.activity_date;
  if (activity.end_time) {
    let end = dayjs.tz(`${date}T${activity.end_time}`, timezone);
    // If end_time is earlier than start_time the activity crosses midnight — shift end to next day.
    if (activity.start_time && activity.end_time < activity.start_time) {
      end = end.add(1, 'day');
    }
    return now.isAfter(end);
  }
  if (activity.start_time) {
    return now.isAfter(dayjs.tz(`${date}T${activity.start_time}`, timezone).add(2, 'hour'));
  }
  return now.isAfter(dayjs.tz(date, timezone).endOf('day'));
}

function isOngoing(activity: Activity, timezone: string): boolean {
  if (!activity.activity_date) return false;
  const now = dayjs();
  const date = activity.activity_date;
  if (activity.start_time && activity.end_time) {
    const start = dayjs.tz(`${date}T${activity.start_time}`, timezone);
    let end = dayjs.tz(`${date}T${activity.end_time}`, timezone);
    // Midnight-crossing activity: shift end to next day.
    if (activity.end_time < activity.start_time) {
      end = end.add(1, 'day');
    }
    return now.isAfter(start) && now.isBefore(end);
  }
  if (activity.start_time) {
    const start = dayjs.tz(`${date}T${activity.start_time}`, timezone);
    return now.isAfter(start) && now.isBefore(start.add(2, 'hour'));
  }
  return dayjs().tz(timezone).isSame(dayjs.tz(date, timezone), 'day');
}

export default function ActivitiesTab() {
  const { t } = useTranslation('activities');
  const { t: tCommon } = useTranslation("common");
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { id: tripId, activityId: _activityId, highlightId: _highlightId } = useLocalSearchParams<{ id: string; activityId?: string; highlightId?: string }>();
  const activityId = _activityId ?? _highlightId;
  const user = useAuthStore((s) => s.user);
  const { data: trip } = useTrip(tripId!);
  const currency = (trip?.base_currency ?? 'EUR') as Currency;
  const [searchQuery, setSearchQuery] = useState('');
  const searchActive = searchQuery.trim().length > 0;

  const activitiesQuery = useActivities(tripId!);
  const { data: pagedData, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = activitiesQuery;
  const ux = getQueryDisplayState(activitiesQuery);
  // useInfiniteQuery's inferred TPageParam widens to `unknown` here (same
  // pre-existing quirk expenses.ts works around with `pageParam as number`
  // inside its queryFn) — cast to the concrete shape the pure helpers expect.
  const pagedActivities = useMemo(
    () => flattenActivities(pagedData as ActivitiesData | undefined),
    [pagedData],
  );

  // Client-side search only covers loaded pages, which would silently miss
  // activities on later pages — so switch the corpus to the whole-trip 'all'
  // cache entry the moment a search starts (usually already warm from the
  // calendar tab). Falls back to searching just the loaded pages until that
  // fetch resolves.
  const allActivitiesQuery = useAllActivities(tripId!, searchActive);
  const searchCorpusReady = !searchActive || allActivitiesQuery.data !== undefined;
  const activities = searchActive && allActivitiesQuery.data ? allActivitiesQuery.data : pagedActivities;

  const { data: role } = useCurrentMemberRole(tripId!);
  const { data: allVotes } = useTripActivityVotes(tripId!);
  const blockedActivityIds = useMemo(() => {
    if (!allVotes) return new Set<string>();
    const blocked = new Set<string>();
    for (const v of allVotes) {
      if (v.vote === 'group_blocker') blocked.add(v.activity_id);
    }
    return blocked;
  }, [allVotes]);
  const createActivity = useCreateActivity();
  const updateActivityMutation = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const closeVoting = useCloseVoting();
  const reopenVoting = useReopenVoting();
  const locked = isTripLocked(trip?.end_date);
  useActivityVotesRealtime(tripId!);

  const { toggle, expand, isCollapsed } = useCollapsibleSections({ defaultCollapsed: ['completed'] });

  const [showCreate, setShowCreate] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const filteredActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q),
    );
  }, [activities, searchQuery]);

  const { inPlanningList, plannedList, blockedList, ongoingList, completedList } = useMemo(() => {
    const tz = trip?.timezone ?? 'Europe/Berlin';
    const inPlanning: Activity[] = [];
    const planned: Activity[] = [];
    const blocked: Activity[] = [];
    const ongoing: Activity[] = [];
    const completed: Activity[] = [];
    for (const a of filteredActivities) {
      if (a.status === 'completed' || a.status === 'skipped') {
        completed.push(a);
      } else if (isAutoCompleted(a, tz)) {
        completed.push(a);
      } else if (isOngoing(a, tz)) {
        ongoing.push(a);
      } else if (a.voting_open && blockedActivityIds.has(a.id)) {
        blocked.push(a);
      } else if (a.voting_open) {
        inPlanning.push(a);
      } else {
        planned.push(a);
      }
    }
    inPlanning.sort(compareActivitiesForDisplay);
    planned.sort(compareActivitiesForDisplay);
    blocked.sort(compareActivitiesForDisplay);
    ongoing.sort(compareActivitiesForDisplay);
    completed.sort(compareActivitiesForDisplay);
    return { inPlanningList: inPlanning, plannedList: planned, blockedList: blocked, ongoingList: ongoing, completedList: completed };
  }, [filteredActivities, blockedActivityIds, trip?.timezone]);

  const rawSections = useMemo(() => {
    const result: { key: string; title: string; data: Activity[] }[] = [];
    if (ongoingList.length > 0) {
      result.push({ key: 'ongoing', title: t('section.ongoing'), data: ongoingList });
    }
    if (inPlanningList.length > 0) {
      result.push({ key: 'in_planning', title: t('section.inPlanning'), data: inPlanningList });
    }
    if (plannedList.length > 0) {
      result.push({ key: 'planned', title: t('section.planned'), data: plannedList });
    }
    if (blockedList.length > 0) {
      result.push({ key: 'blocked', title: t('section.blocked'), data: blockedList });
    }
    if (completedList.length > 0) {
      result.push({ key: 'completed', title: t('section.completed'), data: completedList });
    }
    return result;
  }, [ongoingList, inPlanningList, plannedList, blockedList, completedList]);

  const sections = useMemo(
    () => rawSections.map((s) => ({
      ...s,
      originalCount: s.data.length,
      data: isCollapsed(s.key) ? [] : s.data,
    })),
    [rawSections, isCollapsed],
  );

  const sectionListRef = useRef<SectionList>(null);
  // Target for the pending deep-link scroll, and how many onScrollToIndexFailed retries have
  // been attempted for it — bounded so a target that can never be measured (e.g. filtered out
  // mid-scroll) can't retry forever.
  const scrollTargetRef = useRef<{ sectionIndex: number; itemIndex: number } | null>(null);
  const scrollAttemptsRef = useRef(0);
  // Activity id we've already scrolled to. Prevents a later unrelated re-render (e.g. the
  // batched votes query resolving and reshuffling sections) from yanking the user back after
  // they've scrolled away on their own.
  const scrolledForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activityId || activityId === scrolledForRef.current || rawSections.length === 0) return;
    for (let sectionIndex = 0; sectionIndex < rawSections.length; sectionIndex++) {
      const itemIndex = rawSections[sectionIndex].data.findIndex((a) => a.id === activityId);
      if (itemIndex < 0) continue;
      const sectionKey = rawSections[sectionIndex].key;
      if (isCollapsed(sectionKey)) {
        expand(sectionKey);
        return; // effect re-fires once the section is no longer collapsed
      }
      // +1: within a section, flat index 0 is the section header itself
      // (see VirtualizedSectionList.scrollToLocation) — data row n sits at n + 1.
      const target = { sectionIndex, itemIndex: itemIndex + 1 };
      const timer = setTimeout(() => {
        scrolledForRef.current = activityId;
        scrollTargetRef.current = target;
        scrollAttemptsRef.current = 0;
        sectionListRef.current?.scrollToLocation({ ...target, animated: true, viewOffset: 80 });
        // The scrolled-to card renders expanded and grows asynchronously as its notes load;
        // re-issue the scroll once things have settled so it doesn't drift off-target.
        setTimeout(() => {
          sectionListRef.current?.scrollToLocation({ ...target, animated: false, viewOffset: 80 });
        }, 650);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [activityId, rawSections, isCollapsed, expand]);

  // A deep-linked activity (from a notification, the calendar, or a shared
  // highlight) may not be on a loaded page yet — the scroll effect above only
  // searches rawSections, which is built from the paged feed. Advance page by
  // page until the target appears or the feed is exhausted; the effect above
  // re-runs on its own once rawSections changes.
  const targetOnLoadedPage = !activityId || pagedActivities.some((a) => a.id === activityId);
  useEffect(() => {
    if (!activityId || targetOnLoadedPage || !hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [activityId, targetOnLoadedPage, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleCreate = (input: CreateActivityInput) => {
    setShowCreate(false);
    createActivity.mutate({ tripId: tripId!, input });
  };

  const handleUpdate = (input: UpdateActivityInput) => {
    if (!editingActivity) return;
    setEditingActivity(null);
    updateActivityMutation.mutate({ activityId: editingActivity.id, tripId: tripId!, input });
  };

  if (ux.showSkeleton) {
    return <ActivityListSkeleton />;
  }
  if (ux.showOfflineEmpty) {
    return <OfflineEmptyState onRetry={refetch} />;
  }

  // Whether the trip has any activities at all — deliberately based on the
  // paged feed, not the search-affected `activities` list, so a search that
  // hasn't resolved yet never flashes the "no activities in this trip" empty
  // state for a trip that actually has some.
  const isEmpty = pagedActivities.length === 0 && !searchActive;
  const searchNoResults = searchActive && searchCorpusReady && sections.length === 0;

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
          onScrollToIndexFailed={(info) => {
            const target = scrollTargetRef.current;
            if (!target || scrollAttemptsRef.current >= 3) return;
            scrollAttemptsRef.current += 1;
            // Jump to the estimated offset first so more rows mount and measure, then
            // re-issue the precise scroll — repeating the identical failed call does nothing.
            sectionListRef.current?.getScrollResponder()?.scrollTo({
              y: Math.max(0, info.averageItemLength * info.index - 80),
              animated: false,
            });
            setTimeout(() => {
              sectionListRef.current?.scrollToLocation({ ...target, animated: false, viewOffset: 80 });
            }, 80);
          }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
          ListHeaderComponent={
            <View className="mb-sm">
              <SearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('search.placeholder')}
              />
            </View>
          }
          ListEmptyComponent={
            searchNoResults ? (
              <View className="py-xl items-center gap-sm">
                <ThemedIcon name="search-outline" size={32} color={colors.textMuted} />
                <Text className="text-text-secondary text-body">
                  {t('search.noResults', { query: searchQuery.trim() })}
                </Text>
              </View>
            ) : null
          }
          renderSectionHeader={({ section }) => {
            const cfg = ACTIVITY_SECTION_CONFIG[section.key ?? 'planned'] ?? ACTIVITY_SECTION_CONFIG.planned;
            return (
              <CollapsibleSectionHeader
                icon={cfg.icon}
                iconColor={cfg.iconColor}
                textClass={cfg.textClass}
                title={section.title}
                count={section.originalCount}
                collapsed={isCollapsed(section.key ?? '')}
                onToggle={() => toggle(section.key ?? '')}
              />
            );
          }}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 12 }}>
              <ActivityCardWithVotes
                activity={item}
                tripId={tripId!}
                currentUserId={user?.id}
                role={role}
                currency={currency}
                initialExpanded={item.id === activityId}
                isBlocked={blockedActivityIds.has(item.id)}
                locked={locked}
                onEdit={() => setEditingActivity(item)}
                onDelete={() => deleteActivity.mutate({ activityId: item.id, tripId: tripId! })}
                onCloseVoting={() => closeVoting.mutate({ activityId: item.id, tripId: tripId! })}
                onReopenVoting={() => reopenVoting.mutate({ activityId: item.id, tripId: tripId! })}
                onToggleAutoClose={(val) => updateActivityMutation.mutate({ activityId: item.id, tripId: tripId!, input: { auto_close: val } })}
              />
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={ux.refreshing}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          // No onEndReached here, deliberately — this is a collapsible SectionList
          // (same reasoning as expenses.tsx), so scroll-driven paging would fire
          // spuriously as sections collapse/expand. "Load more" is a footer button.
          ListFooterComponent={
            searchActive && !searchCorpusReady ? (
              <View className="py-md items-center flex-row justify-center gap-sm">
                <ActivityIndicator color={colors.primary} size="small" />
                <Text className="text-text-secondary text-body-small">{t('search.loadingAll')}</Text>
              </View>
            ) : !searchActive && hasNextPage ? (
              <Pressable
                onPress={() => fetchNextPage()}
                className="py-md items-center"
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage
                  ? <ActivityIndicator color={colors.primary} />
                  : <Text className="text-primary text-body font-semibold">{t('loadMore')}</Text>}
              </Pressable>
            ) : null
          }
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => setShowCreate(true)}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 4, ...Platform.select({ web: { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }, default: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 } }) }}
      >
        <ThemedIcon name="add" size={28} color={isColorful ? colors.surfaceElevated : '#FFFFFF'} />
      </Pressable>

      <CreateActivitySheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={isMutationBusy(createActivity)}
        currency={currency}
        tripStartDate={trip?.start_date ?? ''}
        tripEndDate={trip?.end_date ?? ''}
      />

      {editingActivity && (
        <EditActivitySheet
          visible={!!editingActivity}
          onClose={() => setEditingActivity(null)}
          onSubmit={handleUpdate}
          isPending={isMutationBusy(updateActivityMutation)}
          activity={editingActivity}
          currency={currency}
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
  currency,
  initialExpanded,
  isBlocked,
  onEdit,
  onDelete,
  onCloseVoting,
  onReopenVoting,
  onToggleAutoClose,
  locked,
}: {
  activity: Activity;
  tripId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  currency: Currency;
  initialExpanded?: boolean;
  isBlocked: boolean;
  locked: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCloseVoting: () => void;
  onReopenVoting: () => void;
  onToggleAutoClose: (autoClose: boolean) => void;
}) {
  const { t } = useTranslation("activities");
  const { t: tCommon } = useTranslation("common");
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { data: votes = [] } = useActivityVotes(activity.id);
  const { data: members } = useTripMembers(tripId);
  const castVote = useCastVote();
  const removeVote = useRemoveVote(tripId, activity.id);
  const [showVoteSheet, setShowVoteSheet] = useState(false);
  const [showDetail, setShowDetail] = useState(initialExpanded ?? false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCloseVoting, setConfirmingCloseVoting] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const isDiscuss = isBlocked && activity.voting_open;
  const canActOnDiscuss = isDiscuss && (role === 'organizer' || activity.created_by === currentUserId);

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
    setShowVoteSheet(false);
    castVote.mutate({ vote, activityId: activity.id, tripId });
  };

  const handleRemoveVote = () => {
    setShowVoteSheet(false);
    removeVote.mutate(undefined);
  };

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      {activity.description && (
        <View className="gap-xs">
          <Text className="text-label text-text-muted uppercase">{tCommon('label.description')}</Text>
          <Text className="text-body-small text-text-secondary">{activity.description}</Text>
        </View>
      )}
      {activity.external_url && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL(activity.external_url!)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <ThemedIcon name="link-outline" size={14} color={colors.primary} />
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
          <ThemedIcon name="map-outline" size={14} color={colors.primary} />
          <Text className="text-primary text-body-small underline" numberOfLines={1}>
            {activity.maps_url}
          </Text>
        </TouchableOpacity>
      )}

      <ActivityNotesSection
        activityId={activity.id}
        currentUserId={currentUserId}
        role={role}
        memberNameMap={memberMap}
        locked={locked}
      />

      {role === 'organizer' && activity.voting_open && (
        <View className="flex-row items-center justify-between py-xs border-t border-border mt-xs">
          <Text className="text-body-small text-text-secondary">{t('field.autoClose')}</Text>
          <Switch
            value={activity.auto_close}
            onValueChange={onToggleAutoClose}
            trackColor={{ false: '#3E3E3E', true: isColorful ? colors.surface : colors.primary }}
            thumbColor={isColorful ? colors.surfaceElevated : '#FFFFFF'}
            ios_backgroundColor="#3E3E3E"
          />
        </View>
      )}

      <View className="gap-sm mt-xs">
        {confirmingCloseVoting ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text className="text-text-secondary text-body-small">{t('confirm.closeVoting')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onCloseVoting(); setConfirmingCloseVoting(false); }}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(245, 166, 35, 0.2)' }}
            >
              <Text className="text-warning text-body-small font-semibold">{tCommon('button.yes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingCloseVoting(false)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
            >
              <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : confirmingDelete ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text className="text-text-secondary text-body-small">{t('confirm.delete')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onDelete(); setConfirmingDelete(false); }}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(255, 92, 92, 0.2)' }}
            >
              <Text className="text-danger text-body-small font-semibold">{tCommon('button.yes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingDelete(false)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
            >
              <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : confirmingCancel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text className="text-text-secondary text-body-small">{t('confirm.cancelActivity')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onDelete(); setConfirmingCancel(false); }}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: 'rgba(255, 92, 92, 0.2)' }}
            >
              <Text className="text-danger text-body-small font-semibold">{tCommon('button.yes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingCancel(false)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
            >
              <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
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
                <ThemedIcon name="create-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.edit')}</Text>
              </TouchableOpacity>
            )}
            {canActOnDiscuss && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingCloseVoting(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(0, 168, 100, 0.1)' }}
              >
                <ThemedIcon name="checkmark-circle-outline" size={14} color={colors.success} />
                <Text className="text-success text-body-small font-medium">{t('action.markAsPlanned')}</Text>
              </TouchableOpacity>
            )}
            {canActOnDiscuss && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingCancel(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(255, 92, 92, 0.1)' }}
              >
                <ThemedIcon name="close-circle-outline" size={14} color={colors.danger} />
                <Text className="text-danger text-body-small font-medium">{t('action.cancelActivity')}</Text>
              </TouchableOpacity>
            )}
            {!isDiscuss && canCloseVoting && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingCloseVoting(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(245, 166, 35, 0.1)' }}
              >
                <ThemedIcon name="lock-closed-outline" size={14} color={colors.warning} />
                <Text className="text-warning text-body-small font-medium">{t('action.endVoting')}</Text>
              </TouchableOpacity>
            )}
            {canReopenVoting && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onReopenVoting}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(108, 99, 255, 0.1)' }}
              >
                <ThemedIcon name="lock-open-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.reopenVoting')}</Text>
              </TouchableOpacity>
            )}
            {!isDiscuss && canDelete && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingDelete(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(255, 92, 92, 0.1)' }}
              >
                <ThemedIcon name="trash-outline" size={14} color={colors.danger} />
                <Text className="text-danger text-body-small font-medium">{t('action.delete')}</Text>
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
        currency={currency}
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
        isPending={isMutationBusy(castVote)}
        memberMap={memberMap}
      />
    </>
  );
}
