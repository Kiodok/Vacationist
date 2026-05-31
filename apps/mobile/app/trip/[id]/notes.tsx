import { useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { CreateTripNoteInput, TripNote, UpdateTripNoteInput } from '@vacationist/types';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../../../src/features/notes/hooks/useNotes';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { NoteCard } from '../../../src/features/notes/components/NoteCard';
import { EmptyNotes } from '../../../src/features/notes/components/EmptyNotes';
import { CreateNoteSheet } from '../../../src/features/notes/components/CreateNoteSheet';
import { EditNoteSheet } from '../../../src/features/notes/components/EditNoteSheet';
import { ViewNoteSheet } from '../../../src/features/notes/components/ViewNoteSheet';
import { colors } from '@vacationist/ui';

function isTripLocked(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  const diffMs = Date.now() - new Date(endDate + 'T00:00:00').getTime();
  return diffMs > 14 * 24 * 60 * 60 * 1000;
}

export default function NotesTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('notes');
  const currentUser = useAuthStore((s) => s.user);

  const { data: trip } = useTrip(tripId!);
  const { data: notes, isLoading, isFetching, refetch } = useNotes(tripId!);
  const { data: members } = useTripMembers(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const createNote = useCreateNote(tripId!);
  const updateNote = useUpdateNote(tripId!);
  const deleteNote = useDeleteNote(tripId!);

  const locked = isTripLocked(trip?.end_date);

  const [showCreate, setShowCreate] = useState(false);
  const [editingNote, setEditingNote] = useState<TripNote | null>(null);
  const [viewingNote, setViewingNote] = useState<TripNote | null>(null);

  const isOrganizer = role === 'organizer';

  const memberNameMap = new Map(
    (members ?? []).map((m) => [m.user_id, m.user.name])
  );

  const handleCreate = (input: CreateTripNoteInput) => {
    createNote.mutate(input, { onSuccess: () => setShowCreate(false) });
  };

  const handleUpdate = (input: UpdateTripNoteInput) => {
    if (!editingNote) return;
    updateNote.mutate(
      { noteId: editingNote.id, input },
      { onSuccess: () => setEditingNote(null) }
    );
  };

  const handleDelete = () => {
    if (!editingNote) return;
    deleteNote.mutate(editingNote.id, { onSuccess: () => setEditingNote(null) });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isEmpty = !notes || notes.length === 0;

  return (
    <View className="flex-1">
      {isEmpty ? (
        <View className="flex-1 px-md py-md">
          <EmptyNotes />
        </View>
      ) : (
        <FlashList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 8 }}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              authorName={memberNameMap.get(item.created_by) ?? 'Member'}
              onPress={() => {
                const canEdit = isOrganizer || item.created_by === currentUser?.id;
                if (canEdit) {
                  setEditingNote(item);
                } else {
                  setViewingNote(item);
                }
              }}
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
      )}

      {locked ? (
        <View className="flex-row items-center gap-xs px-md py-sm bg-surface border-t border-border">
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
          <Text className="text-body-small text-text-muted flex-1">{t('create.locked')}</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowCreate(true)}
          className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
          style={{ elevation: 6, zIndex: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      <CreateNoteSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={createNote.isPending}
      />

      {editingNote && (
        <EditNoteSheet
          visible={!!editingNote}
          note={editingNote}
          canDelete={isOrganizer || editingNote.created_by === currentUser?.id}
          onClose={() => setEditingNote(null)}
          onSubmit={handleUpdate}
          onDelete={handleDelete}
          isUpdatePending={updateNote.isPending}
          isDeletePending={deleteNote.isPending}
        />
      )}

      {viewingNote && (
        <ViewNoteSheet
          visible={!!viewingNote}
          note={viewingNote}
          onClose={() => setViewingNote(null)}
        />
      )}
    </View>
  );
}
