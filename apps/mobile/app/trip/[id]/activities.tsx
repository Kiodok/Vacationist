import { useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, FlatList, ActivityIndicator, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Activity, VoteType, CreateActivityInput } from '@vacationist/types';
import { useActivities, useCreateActivity, useDeleteActivity, useCloseVoting } from '../../../src/features/activities/hooks/useActivities';
import { useActivityVotes, useCastVote, useRemoveVote } from '../../../src/features/activities/hooks/useVotes';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { ActivityCard } from '../../../src/features/activities/components/ActivityCard';
import { VoteSheet } from '../../../src/features/activities/components/VoteSheet';
import { CreateActivitySheet } from '../../../src/features/activities/components/CreateActivitySheet';
import { EmptyActivities } from '../../../src/features/activities/components/EmptyActivities';

export default function ActivitiesTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: trip } = useTrip(tripId!);
  const { data: activities, isLoading } = useActivities(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const createActivity = useCreateActivity(tripId!);
  const deleteActivity = useDeleteActivity(tripId!);
  const closeVoting = useCloseVoting(tripId!);

  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = (input: CreateActivityInput) => {
    createActivity.mutate(input, { onSuccess: () => setShowCreate(false) });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#6C63FF" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        removeClippedSubviews={false}
        contentContainerClassName="px-md py-md gap-sm"
        contentContainerStyle={activities?.length === 0 ? { flex: 1 } : undefined}
        ListEmptyComponent={<EmptyActivities />}
        renderItem={({ item }) => (
          <ActivityCardWithVotes
            activity={item}
            tripId={tripId!}
            currentUserId={user?.id}
            role={role}
            onDelete={() => deleteActivity.mutate(item.id)}
            onCloseVoting={() => closeVoting.mutate(item.id)}
          />
        )}
      />

      {/* FAB */}
      <Pressable
        onPress={() => setShowCreate(true)}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 4, shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
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
    </View>
  );
}

function ActivityCardWithVotes({
  activity,
  tripId,
  currentUserId,
  role,
  onDelete,
  onCloseVoting,
}: {
  activity: Activity;
  tripId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  onDelete: () => void;
  onCloseVoting: () => void;
}) {
  const { data: votes = [] } = useActivityVotes(activity.id);
  const castVote = useCastVote(tripId, activity.id);
  const removeVote = useRemoveVote(tripId, activity.id);
  const [showVoteSheet, setShowVoteSheet] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCloseVoting, setConfirmingCloseVoting] = useState(false);

  const canDelete =
    role === 'organizer' ||
    (role === 'participant' && activity.created_by === currentUserId);
  const canCloseVoting = role === 'organizer' && activity.voting_open;

  const handleCastVote = (vote: VoteType) => {
    castVote.mutate(vote, { onSuccess: () => setShowVoteSheet(false) });
  };

  const handleRemoveVote = () => {
    removeVote.mutate(undefined, { onSuccess: () => setShowVoteSheet(false) });
  };

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      {activity.external_url && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL(activity.external_url!)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Ionicons name="link-outline" size={14} color="#6C63FF" />
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
          <Ionicons name="map-outline" size={14} color="#6C63FF" />
          <Text className="text-primary text-body-small underline" numberOfLines={1}>
            {activity.maps_url}
          </Text>
        </TouchableOpacity>
      )}

      <View className="gap-sm mt-xs">
        {canCloseVoting && (
          confirmingCloseVoting ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text className="text-text-secondary text-body-small">Close voting permanently?</Text>
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
          ) : (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingCloseVoting(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(245, 166, 35, 0.1)', alignSelf: 'flex-start' }}
            >
              <Ionicons name="lock-closed-outline" size={14} color="#F5A623" />
              <Text className="text-warning text-body-small font-medium">End voting</Text>
            </TouchableOpacity>
          )
        )}
        {canDelete && (
          confirmingDelete ? (
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
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingDelete(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(255, 92, 92, 0.1)', alignSelf: 'flex-start' }}
            >
              <Ionicons name="trash-outline" size={14} color="#FF5C5C" />
              <Text className="text-danger text-body-small font-medium">Delete</Text>
            </TouchableOpacity>
          )
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
      />
    </>
  );
}
