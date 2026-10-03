import { useState, useMemo } from 'react';
import { View, Text, Pressable, TouchableOpacity, ActivityIndicator, Linking, RefreshControl, Switch, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';

import { useTranslation } from 'react-i18next';
import type { Accommodation, VoteType, CreateAccommodationInput, UpdateAccommodationInput, CreateExpenseInput } from '@vacationist/types';
import { useAccommodations, useCreateAccommodation, useUpdateAccommodation, useBookAccommodation, useUnbookAccommodation, useDeleteAccommodation, useCloseAccommodationVoting, useReopenAccommodationVoting } from '../../../src/features/accommodations/hooks/useAccommodations';
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
import { AccommodationNotesSection } from '../../../src/features/accommodations/components/AccommodationNotesSection';
import { CreateExpenseSheet } from '../../../src/features/expenses/components/CreateExpenseSheet';
import { useCreateExpense } from '../../../src/features/expenses/hooks/useExpenses';
import { uploadExpenseDocument } from '@vacationist/api';
import { readFileAsArrayBuffer, type PickedDocumentFile } from '../../../src/utils/documentPicker';
import { createClientId } from '../../../src/utils/optimisticId';
import { useQueryClient } from '@tanstack/react-query';
import { colors, RichText, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';
import { getQueryDisplayState } from '../../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../src/components/OfflineEmptyState';
import { QueryErrorState } from '../../../src/components/QueryErrorState';
import { useToastStore } from '../../../src/stores/toastStore';

export default function AccommodationsTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { t: tExpenses } = useTranslation('expenses');
  const user = useAuthStore((s) => s.user);
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { data: trip } = useTrip(tripId!);
  const { data: members } = useTripMembers(tripId!);
  const accommodationsQuery = useAccommodations(tripId!);
  const { data: accommodations, refetch } = accommodationsQuery;
  const ux = getQueryDisplayState(accommodationsQuery);
  const { data: role } = useCurrentMemberRole(tripId!);
  const createAccommodation = useCreateAccommodation();
  const updateAccommodationMutation = useUpdateAccommodation();
  const deleteAccommodation = useDeleteAccommodation();
  const closeVoting = useCloseAccommodationVoting();
  const reopenVoting = useReopenAccommodationVoting();
  const createExpense = useCreateExpense();
  const queryClient = useQueryClient();
  useAccommodationVotesRealtime(tripId!);

  const [showCreate, setShowCreate] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
  // v1.39.2 task 4: offered right after a successful "Book" — accept creates a split expense
  // linked via related_id (so the cost analysis excludes this accommodation's own price and
  // counts the expense instead); dismiss/cancel leaves it unset, which is today's behavior.
  const [expensePromptAccommodation, setExpensePromptAccommodation] = useState<Accommodation | null>(null);
  // Gated on price_total > 0: an unpriced accommodation would prefill a 0.00 amount, which
  // fails the expense form's positive-amount validation (code review 2026-10-03).
  const onAccommodationBooked = (accommodation: Accommodation) => {
    if (Number(accommodation.price_total ?? 0) > 0) setExpensePromptAccommodation(accommodation);
  };

  // Mirrors expenses.tsx's uploadStagedExpenseDocuments exactly (same accepted gap: lost if the
  // create mutation is queued offline and replays after the app was killed) — fires from the
  // create mutation's onSuccess, never in parallel with it, and surfaces a toast on failure
  // instead of swallowing it (code review 2026-10-03: the expense already exists by the time
  // uploadExpenseDocument runs, so a parallel fire-and-forget upload could race the expense
  // create against the row it needs to attach to, and failures were silently dropped).
  const uploadStagedExpenseDocuments = async (expenseId: string, files: PickedDocumentFile[]) => {
    if (files.length === 0) return;
    const results = await Promise.allSettled(
      files.map(async (file) => {
        const fileData = await readFileAsArrayBuffer(file.uri);
        return uploadExpenseDocument(tripId!, expenseId, fileData, file.fileName, file.mimeType);
      }),
    );
    queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'documents'] });
    const failedCount = results.filter((r) => r.status === 'rejected').length;
    if (failedCount > 0) {
      useToastStore.getState().addToast('error', tExpenses('toast.stagedDocumentsFailed', { count: failedCount }));
    }
  };

  const handleCreate = (input: CreateAccommodationInput) => {
    setShowCreate(false);
    createAccommodation.mutate({ tripId: tripId!, input });
  };

  const handleUpdate = (input: UpdateAccommodationInput) => {
    if (!editingAccommodation) return;
    setEditingAccommodation(null);
    updateAccommodationMutation.mutate({
      accommodationId: editingAccommodation.id,
      tripId: tripId!,
      input,
    });
  };

  if (ux.showSkeleton) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (ux.showOfflineEmpty) {
    return <OfflineEmptyState onRetry={refetch} />;
  }
  if (ux.showError) {
    return <QueryErrorState onRetry={refetch} />;
  }

  return (
    <View className="flex-1">
      <FlashList
        data={accommodations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          accommodations?.length === 0
            ? { flex: 1, paddingHorizontal: 16, paddingVertical: 16 }
            : { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 88 }
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={<EmptyAccommodations />}
        renderItem={({ item }) => (
          <AccommodationCardWithVotes
            accommodation={item}
            tripId={tripId!}
            currentUserId={user?.id}
            role={role}
            tripStartDate={trip?.start_date ?? null}
            tripEndDate={trip?.end_date ?? null}
            onEdit={() => setEditingAccommodation(item)}
            onDelete={() => deleteAccommodation.mutate({ accommodationId: item.id, tripId: tripId! })}
            onCloseVoting={() => closeVoting.mutate({ accommodationId: item.id, tripId: tripId! })}
            onReopenVoting={() => reopenVoting.mutate({ accommodationId: item.id, tripId: tripId! })}
            onToggleAutoClose={(val) => updateAccommodationMutation.mutate({ accommodationId: item.id, tripId: tripId!, input: { auto_close: val } })}
            onBooked={onAccommodationBooked}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={ux.refreshing}
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
        style={{ elevation: 4, ...Platform.select({ web: { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }, default: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 } }) }}
      >
        <ThemedIcon name="add" size={28} color={isColorful ? colors.surfaceElevated : '#FFFFFF'} />
      </Pressable>

      <CreateAccommodationSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={isMutationBusy(createAccommodation)}
        currency={trip?.base_currency ?? 'EUR'}
        tripStartDate={trip?.start_date ?? null}
        tripEndDate={trip?.end_date ?? null}
      />

      {editingAccommodation && (
        <EditAccommodationSheet
          visible={!!editingAccommodation}
          onClose={() => setEditingAccommodation(null)}
          onSubmit={handleUpdate}
          isPending={isMutationBusy(updateAccommodationMutation)}
          accommodation={editingAccommodation}
          currency={trip?.base_currency ?? 'EUR'}
          tripStartDate={trip?.start_date ?? null}
          tripEndDate={trip?.end_date ?? null}
        />
      )}

      {expensePromptAccommodation && user?.id && members && (
        <CreateExpenseSheet
          visible={!!expensePromptAccommodation}
          onClose={() => setExpensePromptAccommodation(null)}
          onSubmit={(input: CreateExpenseInput, stagedFiles: PickedDocumentFile[]) => {
            setExpensePromptAccommodation(null);
            createExpense.mutate(
              { tripId: tripId!, input, id: createClientId() },
              { onSuccess: (expenseId) => { void uploadStagedExpenseDocuments(expenseId, stagedFiles); } },
            );
          }}
          isPending={isMutationBusy(createExpense)}
          members={members}
          currentUserId={user.id}
          currency={trip?.base_currency ?? 'EUR'}
          tripId={tripId!}
          prefill={{
            title: expensePromptAccommodation.title,
            amount: Number(expensePromptAccommodation.price_total ?? 0),
            currency: expensePromptAccommodation.currency,
            relatedType: 'accommodation',
            relatedId: expensePromptAccommodation.id,
            banner: tExpenses('create.linkedToBookingBanner', { title: expensePromptAccommodation.title }),
          }}
        />
      )}
    </View>
  );
}

function AccommodationCardWithVotes({
  accommodation,
  tripId,
  currentUserId,
  role,
  tripStartDate,
  tripEndDate,
  onEdit,
  onDelete,
  onCloseVoting,
  onReopenVoting,
  onToggleAutoClose,
  onBooked,
}: {
  accommodation: Accommodation;
  tripId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  tripStartDate: string | null;
  tripEndDate: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onCloseVoting: () => void;
  onReopenVoting: () => void;
  onToggleAutoClose: (autoClose: boolean) => void;
  /** v1.39.2 task 4: fires after a successful book, so the parent can offer to record a
   * matching expense (expenses.related_id links it so the cost analysis doesn't double-count
   * this booking). Not fired on unbook. */
  onBooked: (accommodation: Accommodation) => void;
}) {
  const { t } = useTranslation('accommodations');
  const { t: tCommon } = useTranslation("common");
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { data: votes = [] } = useAccommodationVotes(accommodation.id);
  const { data: members } = useTripMembers(tripId);
  const castVote = useCastAccommodationVote();
  const removeVote = useRemoveAccommodationVote();
  const bookMutation = useBookAccommodation();
  const unbookMutation = useUnbookAccommodation();
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

  const isDiscuss = votes.some((v) => v.vote === 'group_blocker') && accommodation.voting_open;
  const canActOnDiscuss = isDiscuss && (role === 'organizer' || accommodation.created_by === currentUserId);
  const canBook = role === 'organizer' && !accommodation.voting_open && accommodation.status !== 'booked';
  const canUnbook = role === 'organizer' && !accommodation.voting_open && accommodation.status === 'booked';

  const handleCastVote = (vote: VoteType) => {
    setShowVoteSheet(false);
    castVote.mutate({ vote, accommodationId: accommodation.id, tripId });
  };

  const handleRemoveVote = () => {
    setShowVoteSheet(false);
    removeVote.mutate({ accommodationId: accommodation.id, tripId });
  };

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      {accommodation.description && (
        <View className="gap-xs">
          <Text className="text-label text-text-muted uppercase">{tCommon('label.description')}</Text>
          <RichText className="text-body-small text-text-secondary" selectable>{accommodation.description}</RichText>
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
          <ThemedIcon name="link-outline" size={14} color={colors.primary} />
          <Text className="text-primary text-body-small underline" numberOfLines={1}>
            {accommodation.external_url}
          </Text>
        </TouchableOpacity>
      )}

      {role === 'organizer' && accommodation.voting_open && (
        <View className="flex-row items-center justify-between py-xs border-t border-border mt-xs">
          <Text className="text-body-small text-text-secondary">{t('field.autoClose')}</Text>
          <Switch
            value={accommodation.auto_close}
            onValueChange={onToggleAutoClose}
            trackColor={{ false: '#3E3E3E', true: colors.primary }}
            thumbColor={isColorful ? colors.surface : '#FFFFFF'}
            ios_backgroundColor="#3E3E3E"
          />
        </View>
      )}

      <AccommodationNotesSection
        accommodationId={accommodation.id}
        currentUserId={currentUserId}
        role={role}
        memberNameMap={memberMap}
      />

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
                <ThemedIcon name="create-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.edit')}</Text>
              </TouchableOpacity>
            )}
            {canActOnDiscuss && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingCloseVoting(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-success/10"
              >
                <ThemedIcon name="checkmark-circle-outline" size={14} color={colors.success} />
                <Text className="text-success text-body-small font-medium">{t('action.markAsPlanned')}</Text>
              </TouchableOpacity>
            )}
            {canActOnDiscuss && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingDelete(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-danger/10"
              >
                <ThemedIcon name="close-circle-outline" size={14} color={colors.danger} />
                <Text className="text-danger text-body-small font-medium">{t('action.cancelAccommodation')}</Text>
              </TouchableOpacity>
            )}
            {!isDiscuss && canCloseVoting && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingCloseVoting(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-warning/10"
              >
                <ThemedIcon name="lock-closed-outline" size={14} color={colors.warning} />
                <Text className="text-warning text-body-small font-medium">{t('action.endVoting')}</Text>
              </TouchableOpacity>
            )}
            {canReopenVoting && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onReopenVoting}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              >
                <ThemedIcon name="lock-open-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.reopenVoting')}</Text>
              </TouchableOpacity>
            )}
            {canBook && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => bookMutation.mutate(
                  { accommodationId: accommodation.id, tripId },
                  { onSuccess: () => onBooked(accommodation) },
                )}
                disabled={isMutationBusy(bookMutation)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-success/10"
              >
                <ThemedIcon name="checkmark-circle-outline" size={14} color={colors.success} />
                <Text className="text-success text-body-small font-medium">{t('action.book')}</Text>
              </TouchableOpacity>
            )}
            {canUnbook && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => unbookMutation.mutate({ accommodationId: accommodation.id, tripId })}
                disabled={isMutationBusy(unbookMutation)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-warning/10"
              >
                <ThemedIcon name="close-circle-outline" size={14} color={colors.warning} />
                <Text className="text-warning text-body-small font-medium">{t('action.unbook')}</Text>
              </TouchableOpacity>
            )}
            {!isDiscuss && canDelete && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setConfirmingDelete(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-danger/10"
              >
                <ThemedIcon name="trash-outline" size={14} color={colors.danger} />
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
        isPending={isMutationBusy(castVote)}
        memberMap={memberMap}
      />

    </>
  );
}
