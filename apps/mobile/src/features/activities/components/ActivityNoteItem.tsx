import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import { colors } from '@vacationist/ui';
interface NoteForDisplay {
  content: string;
  created_at: string;
}

interface ActivityNoteItemProps {
  note: NoteForDisplay;
  authorName: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function ActivityNoteItem({ note, authorName, canEdit, canDelete, onEdit, onDelete }: ActivityNoteItemProps) {
  return (
    <View className="bg-surface border border-border rounded-sm p-sm gap-xs">
      <Text className="text-body-small text-text-secondary">{note.content}</Text>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-xs">
          <Text className="text-label text-text-muted">{authorName}</Text>
          <Text className="text-label text-text-muted">·</Text>
          <Text className="text-label text-text-muted">{dayjs(note.created_at).fromNow()}</Text>
        </View>
        <View className="flex-row items-center gap-xs">
          {canEdit && (
            <Pressable onPress={onEdit} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Ionicons name="create-outline" size={14} color={colors.primary} />
            </Pressable>
          )}
          {canDelete && !canEdit && (
            <Pressable onPress={onDelete} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
