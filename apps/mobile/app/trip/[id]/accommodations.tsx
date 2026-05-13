import { useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, FlatList, ActivityIndicator, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Accommodation, VoteType, CreateAccommodationInput } from '@vacationist/types';
import { useAccommodations, useCreateAccommodation, useDeleteAccommodation, useCloseAccommodationVoting } from '../../../src/features/accommodations/hooks/useAccommodations';
import { useAccommodationVotes, useCastAccommodationVote, useRemoveAccommodationVote } from '../../../src/features/accommodations/hooks/useAccommodationVotes';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { AccommodationCard } from '../../../src/features/accommodations/components/AccommodationCard';
import { VoteSheet } from '../../../src/features/activities/components/VoteSheet';
import { CreateAccommodationSheet } from '../../../src/features/accommodations/components/CreateAccommodationSheet';
import { EmptyAccommodations } from '../../../src/features/accommodations/components/EmptyAccommodations';

export default function AccommodationsTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: trip } = useTrip(tripId!);
  const { data: accommodations, isLoading } = useAccommodations(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const createAccommodation = useCreateAccommodation(tripId!);
  const deleteAccommodation = useDeleteAccommodation(tripId!);
  const closeVoting = useCloseAccommodationVoting(tripId!);

  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = (input: CreateAccommodationInput) => {
    createAccommodation.mutate(input, { onSuccess: () => setShowCreate(false) });
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
        data={accommodations}
        keyExtractor={(item) => item.id}
        removeClippedSubviews={false}
        contentContainerClassName="px-md py-md gap-sm"
        contentContainerStyle={accommodations?.length === 0 ? { flex: 1 } : undefined}
        ListEmptyComponent={<EmptyAccommodations />}
        renderItem={({ item }) => (
          <AccommodationCardWithVotes
            accommodation={item}
            tripId={tripId!}
            currentUserId={user?.id}
            currency={trip?.base_currency ?? 'EUR'}
            role={role}
            onDelete={() => deleteAccommodation.mutate(item.id)}
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

      <CreateAccommodationSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={createAccommodation.isPending}
        currency={trip?.base_currency ?? 'EUR'}
      />
    </View>
  );
}

function AccommodationCardWithVotes({
  accommodation,
  tripId,
  currentUserId,
  currency,
  role,
  onDelete,
  onCloseVoting,
}: {
  accommodation: Accommodation;
  tripId: string;
  currentUserId: string | undefined;
  currency: string;
  role: string | null | undefined;
  onDelete: () => void;
  onCloseVoting: () => void;
}) {
  const { data: votes = [] } = useAccommodationVotes(accommodation.id);
  const castVote = useCastAccommodationVote(tripId, accommodation.id);
  const removeVote = useRemoveAccommodationVote(tripId, accommodation.id);
  const [showVoteSheet, setShowVoteSheet] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCloseVoting, setConfirmingCloseVoting] = useState(false);

  const canDelete =
    role === 'organizer' ||
    (role === 'participant' && accommodation.created_by === currentUserId);
  const canCloseVoting = role === 'organizer' && accommodation.voting_open;

  const handleCastVote = (vote: VoteType) => {
    castVote.mutate(vote, { onSuccess: () => setShowVoteSheet(false) });
  };

  const handleRemoveVote = () => {
    removeVote.mutate(undefined, { onSuccess: () => setShowVoteSheet(false) });
  };

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      {accommodation.notes && (
        <View className="gap-xs">
          <Text className="text-label text-text-muted uppercase">Notes</Text>
          <Text className="text-body-small text-text-secondary">{accommodation.notes}</Text>
        </View>
      )}
      {accommodation.external_url && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL(accommodation.external_url!)}
          className="flex-row items-center gap-xs"
        >
          <Ionicons name="link-outline" size={14} color="#6C63FF" />
          <Text className="text-primary text-body-small underline" numberOfLines={1}>
            {accommodation.external_url}
          </Text>
        </TouchableOpacity>
      )}

      <View className="gap-sm mt-xs">
        {confirmingCloseVoting ? (
          <View className="flex-row items-center gap-sm">
            <Text className="text-text-secondary text-body-small">Close voting permanently?</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onCloseVoting(); setConfirmingCloseVoting(false); }}
              className="px-sm py-xs rounded-sm bg-warning/20"
            >
              <Text className="text-warning text-body-small font-semibold">Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingCloseVoting(false)}
              className="px-sm py-xs rounded-sm"
            >
              <Text className="text-text-secondary text-body-small">Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : confirmingDelete ? (
          <View className="flex-row items-center gap-sm">
            <Text className="text-text-secondary text-body-small">Remove this accommodation?</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onDelete(); setConfirmingDelete(false); }}
              className="px-sm py-xs rounded-sm bg-danger/20"
            >
              <Text className="text-danger text-body-small font-semibold">Yes, remove</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingDelete(false)}
              className="px-sm py-xs rounded-sm"
            >
              <Text className="text-text-secondary text-body-small">Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row gap-sm">
            {canCloseVoting && votes.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingCloseVoting(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-warning/10"
              >
                <Ionicons name="lock-closed-outline" size={14} color="#F5A623" />
                <Text className="text-warning text-body-small font-medium">End voting</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingDelete(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-danger/10"
              >
                <Ionicons name="trash-outline" size={14} color="#FF5C5C" />
                <Text className="text-danger text-body-small font-medium">Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  ) : undefined;

  return (
    <>
      <AccommodationCard
        accommodation={accommodation}
        votes={votes}
        currentUserId={currentUserId}
        currency={currency}
        onPress={() => setShowDetail(!showDetail)}
        onVotePress={() => setShowVoteSheet(true)}
        detail={detailContent}
      />

      <VoteSheet
        visible={showVoteSheet}
        onClose={() => setShowVoteSheet(false)}
        votes={votes}
        currentUserId={currentUserId}
        votingOpen={accommodation.voting_open}
        onCastVote={handleCastVote}
        onRemoveVote={handleRemoveVote}
        isPending={castVote.isPending}
      />
    </>
  );
}
