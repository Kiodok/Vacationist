import { useState } from 'react';
import { View, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CreateTripNoteInput, TripNote, UpdateTripNoteInput } from '@vacationist/types';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../../../src/features/notes/hooks/useNotes';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { NoteCard } from '../../../src/features/notes/components/NoteCard';
import { EmptyNotes } from '../../../src/features/notes/components/EmptyNotes';
import { CreateNoteSheet } from '../../../src/features/notes/components/CreateNoteSheet';
import { EditNoteSheet } from '../../../src/features/notes/components/EditNoteSheet';

export default function NotesTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const currentUser = useAuthStore((s) => s.user);

  const { data: notes, isLoading } = useNotes(tripId!);
  const { data: members } = useTripMembers(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const createNote = useCreateNote(tripId!);
  const updateNote = useUpdateNote(tripId!);
  const deleteNote = useDeleteNote(tripId!);

  const [showCreate, setShowCreate] = useState(false);
  const [editingNote, setEditingNote] = useState<TripNote | null>(null);

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
        <ActivityIndicator color="#6C63FF" />
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
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-md py-md gap-sm"
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              authorName={memberNameMap.get(item.created_by) ?? 'Member'}
              onPress={() => setEditingNote(item)}
            />
          )}
        />
      )}

      <Pressable
        onPress={() => setShowCreate(true)}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 6, zIndex: 10, shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

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
    </View>
  );
}
