import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import { colors } from '@vacationist/ui';
import type { TripNote } from '@vacationist/types';

interface NoteCardProps {
  note: TripNote;
  authorName: string;
  onPress: () => void;
  onToggleDone: () => void;
  onLongPress?: () => void;
}

export function NoteCard({ note, authorName, onPress, onToggleDone, onLongPress }: NoteCardProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className={`bg-surface border rounded-md p-md gap-xs ${note.is_done ? 'border-success/30' : 'border-border'}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View className="flex-row items-start justify-between">
        <Text
          className={`text-body font-semibold flex-1 mr-sm ${note.is_done ? 'line-through text-text-muted' : 'text-text-primary'}`}
          numberOfLines={2}
        >
          {note.title}
        </Text>
        {/* Done checkbox — tapping only this area toggles done, not the whole card */}
        <Pressable onPress={onToggleDone} hitSlop={12}>
          <View
            className={`w-[22px] h-[22px] rounded-sm border-2 items-center justify-center ${
              note.is_done ? 'bg-success border-success' : 'border-border'
            }`}
          >
            {note.is_done && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
        </Pressable>
      </View>

      {!!note.description && (
        <Text
          className={`text-body-small ${note.is_done ? 'text-text-muted' : 'text-text-secondary'}`}
          numberOfLines={2}
        >
          {note.description}
        </Text>
      )}

      <View className="flex-row items-center gap-xs mt-xs">
        <Text className="text-label text-text-muted">{authorName}</Text>
        <Text className="text-label text-text-muted">·</Text>
        <Text className="text-label text-text-muted">{dayjs(note.updated_at).fromNow()}</Text>
      </View>
    </Pressable>
  );
}
