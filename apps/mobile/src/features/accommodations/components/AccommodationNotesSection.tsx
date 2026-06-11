import { useState } from 'react';
import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';
import { ActivityNoteItem } from '../../activities/components/ActivityNoteItem';
import type { AccommodationNote, CreateAccommodationNoteInput, UpdateAccommodationNoteInput } from '@vacationist/types';
import {
  useAccommodationNotes,
  useCreateAccommodationNote,
  useUpdateAccommodationNote,
  useDeleteAccommodationNote,
} from '../hooks/useAccommodationNotes';
import { CreateNoteSheet } from '../../../components/CreateNoteSheet';
import { EditNoteSheet } from '../../../components/EditNoteSheet';

interface AccommodationNotesSectionProps {
  accommodationId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  memberNameMap: Map<string, string>;
}

export function AccommodationNotesSection({
  accommodationId,
  currentUserId,
  role,
  memberNameMap,
}: AccommodationNotesSectionProps) {
  const { t } = useTranslation('accommodationNotes');
  const { t: tCommon } = useTranslation('common');
  const [showCreate, setShowCreate] = useState(false);
  const [editingNote, setEditingNote] = useState<AccommodationNote | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const { data: notes = [] } = useAccommodationNotes(accommodationId);
  const createNote = useCreateAccommodationNote(accommodationId);
  const updateNote = useUpdateAccommodationNote(accommodationId);
  const deleteNote = useDeleteAccommodationNote(accommodationId);

  const handleCreate = (input: CreateAccommodationNoteInput) => {
    createNote.mutate(input, { onSuccess: () => setShowCreate(false) });
  };

  const handleUpdate = (input: UpdateAccommodationNoteInput) => {
    if (!editingNote) return;
    updateNote.mutate(
      { noteId: editingNote.id, input },
      { onSuccess: () => setEditingNote(null) },
    );
  };

  const handleDeleteFromSheet = () => {
    if (!editingNote) return;
    deleteNote.mutate(editingNote.id, { onSuccess: () => setEditingNote(null) });
  };

  const handleDirectDelete = (noteId: string) => {
    deleteNote.mutate(noteId, { onSuccess: () => setConfirmingDeleteId(null) });
  };

  const sectionTitle = notes.length > 0
    ? t('section.titleCount', { count: notes.length })
    : t('section.title');

  return (
    <>
      <View className="border-t border-border mt-xs pt-sm gap-sm">
        <View className="flex-row items-center justify-between">
          <Text className="text-label text-text-muted uppercase">{sectionTitle}</Text>
          <Pressable
            onPress={() => setShowCreate(true)}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
            <Text className="text-primary text-label">{t('action.addNote')}</Text>
          </Pressable>
        </View>

        {notes.length === 0 && (
          <Text className="text-label text-text-muted italic">{t('empty.message')}</Text>
        )}

        {notes.map((note) => {
          const isOwner = note.created_by === currentUserId;
          const isOrganizer = role === 'organizer';
          const canEdit = isOwner;
          const canDelete = isOwner || isOrganizer;

          if (confirmingDeleteId === note.id) {
            return (
              <View key={note.id} className="flex-row items-center gap-sm bg-surface border border-danger/30 rounded-sm px-sm py-xs">
                <Text className="text-body-small text-text-secondary flex-1">{t('confirm.delete')}</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setConfirmingDeleteId(null)}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 }}
                >
                  <Text className="text-body-small text-text-secondary">{tCommon('button.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleDirectDelete(note.id)}
                  style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: 'rgba(255,92,92,0.15)' }}
                  disabled={deleteNote.isPending}
                >
                  <Text className="text-body-small text-danger font-semibold">{tCommon('button.delete')}</Text>
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <ActivityNoteItem
              key={note.id}
              note={note}
              authorName={memberNameMap.get(note.created_by) ?? '—'}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => setEditingNote(note)}
              onDelete={() => {
                if (canEdit) {
                  setEditingNote(note);
                } else {
                  setConfirmingDeleteId(note.id);
                }
              }}
            />
          );
        })}
      </View>

      <CreateNoteSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={createNote.isPending}
        namespace="accommodationNotes"
      />

      {editingNote && (
        <EditNoteSheet
          visible
          note={editingNote}
          canDelete={editingNote.created_by === currentUserId || role === 'organizer'}
          onClose={() => setEditingNote(null)}
          onSubmit={handleUpdate}
          onDelete={handleDeleteFromSheet}
          isUpdatePending={updateNote.isPending}
          isDeletePending={deleteNote.isPending}
          namespace="accommodationNotes"
        />
      )}
    </>
  );
}
