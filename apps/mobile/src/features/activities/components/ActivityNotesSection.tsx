import { useState } from 'react';
import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors , ThemedIcon } from '@vacationist/ui';
import type { ActivityNote, CreateActivityNoteInput, UpdateActivityNoteInput } from '@vacationist/types';
import {
  useActivityNotes,
  useCreateActivityNote,
  useUpdateActivityNote,
  useDeleteActivityNote,
} from '../hooks/useActivityNotes';
import { ActivityNoteItem } from './ActivityNoteItem';
import { CreateNoteSheet } from '../../../components/CreateNoteSheet';
import { EditNoteSheet } from '../../../components/EditNoteSheet';
import { isMutationBusy } from '../../../utils/mutationStatus';

interface ActivityNotesSectionProps {
  activityId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  memberNameMap: Map<string, string>;
  locked: boolean;
}

export function ActivityNotesSection({
  activityId,
  currentUserId,
  role,
  memberNameMap,
  locked,
}: ActivityNotesSectionProps) {
  const { t } = useTranslation('activityNotes');
  const { t: tCommon } = useTranslation('common');
  const [showCreate, setShowCreate] = useState(false);
  const [editingNote, setEditingNote] = useState<ActivityNote | null>(null);
  // confirmingDeleteId: for organizer-deletes-another-member's-note (no edit sheet needed)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const { data: notes = [] } = useActivityNotes(activityId);
  const createNote = useCreateActivityNote(activityId);
  const updateNote = useUpdateActivityNote(activityId);
  const deleteNote = useDeleteActivityNote(activityId);

  const handleCreate = (input: CreateActivityNoteInput) => {
    setShowCreate(false);
    createNote.mutate(input);
  };

  const handleUpdate = (input: UpdateActivityNoteInput) => {
    if (!editingNote) return;
    setEditingNote(null);
    updateNote.mutate({ noteId: editingNote.id, input });
  };

  const handleDeleteFromSheet = () => {
    if (!editingNote) return;
    setEditingNote(null);
    deleteNote.mutate(editingNote.id);
  };

  const handleDirectDelete = (noteId: string) => {
    setConfirmingDeleteId(null);
    deleteNote.mutate(noteId);
  };

  const sectionTitle = notes.length > 0
    ? t('section.titleCount', { count: notes.length })
    : t('section.title');

  return (
    <>
      <View className="border-t border-border mt-xs pt-sm gap-sm">
        <View className="flex-row items-center justify-between">
          <Text className="text-label text-text-muted uppercase">{sectionTitle}</Text>
          {!locked && (
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
              <ThemedIcon name="add-circle-outline" size={14} color={colors.primary} />
              <Text className="text-primary text-label">{t('action.addNote')}</Text>
            </Pressable>
          )}
        </View>

        {notes.length === 0 && !locked && (
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
                  // owner: open edit sheet which also contains the delete flow
                  setEditingNote(note);
                } else {
                  // organizer deleting someone else's note: inline confirm
                  setConfirmingDeleteId(note.id);
                }
              }}
            />
          );
        })}

        {locked && (
          <Text className="text-label text-text-muted italic">{t('create.locked')}</Text>
        )}
      </View>

      <CreateNoteSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={isMutationBusy(createNote)}
        namespace="activityNotes"
      />

      {editingNote && (
        <EditNoteSheet
          visible
          note={editingNote}
          canDelete={editingNote.created_by === currentUserId || role === 'organizer'}
          onClose={() => setEditingNote(null)}
          onSubmit={handleUpdate}
          onDelete={handleDeleteFromSheet}
          isUpdatePending={isMutationBusy(updateNote)}
          isDeletePending={isMutationBusy(deleteNote)}
          namespace="activityNotes"
        />
      )}
    </>
  );
}
