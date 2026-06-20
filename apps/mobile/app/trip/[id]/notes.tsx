import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';

import { useTranslation } from 'react-i18next';
import type { CreateTripNoteInput, TripNote, UpdateTripNoteInput } from '@vacationist/types';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote, useToggleNoteDone } from '../../../src/features/notes/hooks/useNotes';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { NoteCard } from '../../../src/features/notes/components/NoteCard';
import { EmptyNotes } from '../../../src/features/notes/components/EmptyNotes';
import { CreateNoteSheet } from '../../../src/features/notes/components/CreateNoteSheet';
import { EditNoteSheet } from '../../../src/features/notes/components/EditNoteSheet';
import { ViewNoteSheet } from '../../../src/features/notes/components/ViewNoteSheet';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';
import { getQueryDisplayState } from '../../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../src/components/OfflineEmptyState';

function isTripLocked(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  const diffMs = Date.now() - new Date(endDate + 'T00:00:00').getTime();
  return diffMs > 14 * 24 * 60 * 60 * 1000;
}

export default function NotesTab() {
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { id: tripId, highlightId } = useLocalSearchParams<{ id: string; highlightId?: string }>();
  const { t } = useTranslation('notes');
  const currentUser = useAuthStore((s) => s.user);

  const { data: trip } = useTrip(tripId!);
  const notesQuery = useNotes(tripId!);
  const { data: notes, refetch } = notesQuery;
  const ux = getQueryDisplayState(notesQuery);
  const { data: members } = useTripMembers(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const toggleDone = useToggleNoteDone();

  const locked = isTripLocked(trip?.end_date);

  const [showCreate, setShowCreate] = useState(false);
  const [editingNote, setEditingNote] = useState<TripNote | null>(null);
  const [viewingNote, setViewingNote] = useState<TripNote | null>(null);
  const [showDone, setShowDone] = useState(false);

  const isOrganizer = role === 'organizer';

  const memberNameMap = useMemo(
    () => new Map((members ?? []).map((m) => [m.user_id, m.user.name])),
    [members],
  );

  const activeNotes = useMemo(() => notes?.filter((n) => !n.is_done) ?? [], [notes]);
  const doneNotes = useMemo(() => notes?.filter((n) => n.is_done) ?? [], [notes]);

  const listRef = useRef<FlashListRef<TripNote>>(null);
  useEffect(() => {
    if (!highlightId || !activeNotes.length) return;
    const idx = activeNotes.findIndex((n) => n.id === highlightId);
    if (idx < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: idx, animated: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightId, activeNotes]);

  const handleCreate = (input: CreateTripNoteInput) => {
    setShowCreate(false);
    createNote.mutate({ tripId: tripId!, input });
  };

  const handleUpdate = (input: UpdateTripNoteInput) => {
    if (!editingNote) return;
    setEditingNote(null);
    updateNote.mutate({ noteId: editingNote.id, tripId: tripId!, input });
  };

  const handleDelete = () => {
    if (!editingNote) return;
    setEditingNote(null);
    deleteNote.mutate({ noteId: editingNote.id, tripId: tripId! });
  };

  const handleToggleDone = (note: TripNote) => {
    toggleDone.mutate({ noteId: note.id, tripId: tripId!, isDone: !note.is_done });
  };

  const handleNotePress = (note: TripNote) => {
    const canEdit = isOrganizer || note.created_by === currentUser?.id;
    if (canEdit) {
      setEditingNote(note);
    } else {
      setViewingNote(note);
    }
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

  const isEmpty = activeNotes.length === 0 && doneNotes.length === 0;

  return (
    <View className="flex-1">
      {isEmpty ? (
        <View className="flex-1 px-md py-md">
          <EmptyNotes />
        </View>
      ) : (
        <FlashList
          ref={listRef}
          data={activeNotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              authorName={memberNameMap.get(item.created_by) ?? 'Member'}
              onPress={() => handleNotePress(item)}
              onToggleDone={() => handleToggleDone(item)}
              highlight={item.id === highlightId}
            />
          )}
          ListFooterComponent={
            doneNotes.length > 0 ? (
              <View style={{ marginTop: activeNotes.length > 0 ? 12 : 0 }}>
                <Pressable
                  onPress={() => setShowDone((v) => !v)}
                  className="flex-row items-center gap-xs py-sm px-xs"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <ThemedIcon
                    name={showDone ? 'chevron-down' : 'chevron-forward'}
                    size={16}
                    color={colors.success}
                  />
                  <ThemedIcon name="checkmark-done-outline" size={14} color={colors.success} />
                  <Text className="text-body-small font-semibold text-success">
                    {t('section.doneCount', { count: doneNotes.length })}
                  </Text>
                </Pressable>

                {showDone && (
                  <View style={{ gap: 12 }}>
                    {doneNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        authorName={memberNameMap.get(note.created_by) ?? 'Member'}
                        onPress={() => handleNotePress(note)}
                        onToggleDone={() => handleToggleDone(note)}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={ux.refreshing}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {locked ? (
        <View className="flex-row items-center gap-xs px-md py-sm bg-surface border-t border-border">
          <ThemedIcon name="lock-closed-outline" size={14} color={colors.textMuted} />
          <Text className="text-body-small text-text-muted flex-1">{t('create.locked')}</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => setShowCreate(true)}
          className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
          style={{ elevation: 6, zIndex: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
        >
          <ThemedIcon name="add" size={28} color={isColorful ? colors.surfaceElevated : '#FFFFFF'} />
        </Pressable>
      )}

      <CreateNoteSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={isMutationBusy(createNote)}
      />

      {editingNote && (
        <EditNoteSheet
          visible={!!editingNote}
          note={editingNote}
          canDelete={isOrganizer || editingNote.created_by === currentUser?.id}
          onClose={() => setEditingNote(null)}
          onSubmit={handleUpdate}
          onDelete={handleDelete}
          isUpdatePending={isMutationBusy(updateNote)}
          isDeletePending={isMutationBusy(deleteNote)}
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
