import { useState, useMemo } from 'react';
import { View, Text, Pressable, TouchableOpacity, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Accommodation, VoteType, CreateAccommodationInput, UpdateAccommodationInput } from '@vacationist/types';
import { useAccommodations, useCreateAccommodation, useUpdateAccommodation, useDeleteAccommodation, useCloseAccommodationVoting, useReopenAccommodationVoting } from '../../../src/features/accommodations/hooks/useAccommodations';
import { useAccommodationVotes, useCastAccommodationVote, useRemoveAccommodationVote } from '../../../src/features/accommodations/hooks/useAccommodationVotes';
import { useAccommodationVotesRealtime } from '../../../src/features/accommodations/hooks/useAccommodationVotesRealtime';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useCurrentMemberRole, useTripMembers } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { AccommodationCard } from '../../../src/features/accommodations/components/AccommodationCard';
import { VoteSheet } from '../../../src/features/activities/components/VoteSheet';
import { CreateAccommodationSheet } from '../../../src/features/accommodations/components/CreateAccommodationSheet';
import { EditAccommodationSheet } from '../../../src/features/accommodations/components/EditAccommodationSheet';
import { EmptyAccommodations } from '../../../src/features/accommodations/components/EmptyAccommodations';
import { colors } from '@vacationist/ui';

export default function AccommodationsTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: trip } = useTrip(tripId!);
  const { data: accommodations, isLoading, isFetching, refetch } = useAccommodations(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const createAccommodation = useCreateAccommodation(tripId!);
  const updateAccommodationMutation = useUpdateAccommodation(tripId!);
  const deleteAccommodation = useDeleteAccommodation(tripId!);
  const closeVoting = useCloseAccommodationVoting(tripId!);
  const reopenVoting = useReopenAccommodationVoting(tripId!);
  useAccommodationVotesRealtime(tripId!);

  const [showCreate, setShowCreate] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);

  const handleCreate = (input: CreateAccommodationInput) => {
    createAccommodation.mutate(input, { onSuccess: () => setShowCreate(false) });
  };

  const handleUpdate = (input: UpdateAccommodationInput) => {
    if (!editingAccommodation) return;
    updateAccommodationMutation.mutate(
      { accommodationId: editingAccommodation.id, input },
      { onSuccess: () => setEditingAccommodation(null) },
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <FlashList
        data={accommodations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          accommodations?.length === 0
            ? { flex: 1, paddingHorizontal: 16, paddingVertical: 16 }
            : { paddingHorizontal: 16, paddingVertical: 16, gap: 8 }
        }
        ListEmptyComponent={<EmptyAccommodations />}
        renderItem={({ item }) => (
          <AccommodationCardWithVotes
            accommodation={item}
            tripId={tripId!}
            currentUserId={user?.id}
            currency={trip?.base_currency ?? 'EUR'}
            role={role}
            onEdit={() => setEditingAccommodation(item)}
            onDelete={() => deleteAccommodation.mutate(item.id)}
            onCloseVoting={() => closeVoting.mutate(item.id)}
            onReopenVoting={() => reopenVoting.mutate(item.id)}
          />
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

      {/* FAB */}
      <Pressable
        onPress={() => setShowCreate(true)}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
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

      {editingAccommodation && (
        <EditAccommodationSheet
          visible={!!editingAccommodation}
          onClose={() => setEditingAccommodation(null)}
          onSubmit={handleUpdate}
          isPending={updateAccommodationMutation.isPending}
          accommodation={editingAccommodation}
          currency={trip?.base_currency ?? 'EUR'}
        />
      )}
    </View>
  );
}

function AccommodationCardWithVotes({
  accommodation,
  tripId,
  currentUserId,
  currency,
  role,
  onEdit,
  onDelete,
  onCloseVoting,
  onReopenVoting,
}: {
  accommodation: Accommodation;
  tripId: string;
  currentUserId: string | undefined;
  currency: string;
  role: string | null | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onCloseVoting: () => void;
  onReopenVoting: () => void;
}) {
  const { t } = useTranslation('accommodations');
  const { t: tCommon } = useTranslation("common");
  const { data: votes = [] } = useAccommodationVotes(accommodation.id);
  const { data: members } = useTripMembers(tripId);
  const castVote = useCastAccommodationVote();
  const removeVote = useRemoveAccommodationVote(tripId, accommodation.id);
  const [showVoteSheet, setShowVoteSheet] = useState(false);

  const memberMap = useMemo(
    () => new Map((members ?? []).map((m) => [m.user_id, m.user.name])),
    [members],
  );
  const [showDetail, setShowDetail] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingCloseVoting, setConfirmingCloseVoting] = useState(false);

  const canEdit =
    role === 'organizer' ||
    (role === 'participant' && accommodation.created_by === currentUserId);
  const canDelete =
    role === 'organizer' ||
    (role === 'participant' && accommodation.created_by === currentUserId);
  const canCloseVoting = role === 'organizer' && accommodation.voting_open;
  const canReopenVoting = role === 'organizer' && !accommodation.voting_open;

  const handleCastVote = (vote: VoteType) => {
    castVote.mutate({ vote, accommodationId: accommodation.id, tripId }, { onSuccess: () => setShowVoteSheet(false) });
  };

  const handleRemoveVote = () => {
    removeVote.mutate(undefined, { onSuccess: () => setShowVoteSheet(false) });
  };

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      {accommodation.description && (
        <View className="gap-xs">
          <Text className="text-label text-text-muted uppercase">{tCommon('label.description')}</Text>
          <Text className="text-body-small text-text-secondary">{accommodation.description}</Text>
        </View>
      )}
      {accommodation.notes && (
        <View className="gap-xs">
          <Text className="text-label text-text-muted uppercase">{tCommon('label.notes')}</Text>
          <Text className="text-body-small text-text-secondary">{accommodation.notes}</Text>
        </View>
      )}
      {accommodation.external_url && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL(accommodation.external_url!)}
          className="flex-row items-center gap-xs"
        >
          <Ionicons name="link-outline" size={14} color={colors.primary} />
          <Text className="text-primary text-body-small underline" numberOfLines={1}>
            {accommodation.external_url}
          </Text>
        </TouchableOpacity>
      )}

      <View className="gap-sm mt-xs">
        {confirmingCloseVoting ? (
          <View className="flex-row items-center gap-sm">
            <Text className="text-text-secondary text-body-small">{t('confirm.closeVoting')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onCloseVoting(); setConfirmingCloseVoting(false); }}
              className="px-sm py-xs rounded-sm bg-warning/20"
            >
              <Text className="text-warning text-body-small font-semibold">{tCommon('button.yes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingCloseVoting(false)}
              className="px-sm py-xs rounded-sm"
            >
              <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : confirmingDelete ? (
          <View className="flex-row items-center gap-sm">
            <Text className="text-text-secondary text-body-small">{t('confirm.remove')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { onDelete(); setConfirmingDelete(false); }}
              className="px-sm py-xs rounded-sm bg-danger/20"
            >
              <Text className="text-danger text-body-small font-semibold">{t('confirm.removeYes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setConfirmingDelete(false)}
              className="px-sm py-xs rounded-sm"
            >
              <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row gap-sm flex-wrap">
            {canEdit && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onEdit}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              >
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.edit')}</Text>
              </TouchableOpacity>
            )}
            {canCloseVoting && votes.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingCloseVoting(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-warning/10"
              >
                <Ionicons name="lock-closed-outline" size={14} color={colors.warning} />
                <Text className="text-warning text-body-small font-medium">{t('action.endVoting')}</Text>
              </TouchableOpacity>
            )}
            {canReopenVoting && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onReopenVoting}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              >
                <Ionicons name="lock-open-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.reopenVoting')}</Text>
              </TouchableOpacity>
            )}
            {canDelete && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingDelete(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-danger/10"
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text className="text-danger text-body-small font-medium">{t('action.remove')}</Text>
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
        memberMap={memberMap}
      />
    </>
  );
}
