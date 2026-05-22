import { View, Text, Pressable } from 'react-native';
import { dayjs } from '@vacationist/utils';
import type { TripNote } from '@vacationist/types';

interface NoteCardProps {
  note: TripNote;
  authorName: string;
  onPress: () => void;
  onLongPress?: () => void;
}

export function NoteCard({ note, authorName, onPress, onLongPress }: NoteCardProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="bg-surface border border-border rounded-md p-md gap-xs"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Text className="text-body font-semibold text-text-primary" numberOfLines={2}>
        {note.title}
      </Text>
      {!!note.description && (
        <Text className="text-body-small text-text-secondary" numberOfLines={2}>
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
