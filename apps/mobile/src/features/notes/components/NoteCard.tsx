import { Animated, Platform, Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import { colors } from '@vacationist/ui';
import type { TripNote } from '@vacationist/types';
import { useHighlightAnimation } from '../../../hooks/useHighlightAnimation';

interface NoteCardProps {
  note: TripNote;
  authorName: string;
  onPress: () => void;
  onToggleDone: () => void;
  onLongPress?: () => void;
  highlight?: boolean;
}

export function NoteCard({ note, authorName, onPress, onToggleDone, onLongPress, highlight }: NoteCardProps) {
  const baseBorderColor = note.is_done ? 'rgba(62,207,142,0.3)' : colors.border;
  const { animatedBorderColor } = useHighlightAnimation(highlight, baseBorderColor);

  return (
    <Animated.View
      className="bg-surface rounded-md"
      style={{ borderWidth: 1, borderColor: animatedBorderColor, ...(Platform.OS === 'web' ? { borderStyle: 'solid' as const } : {}) }}
    >
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="p-md gap-xs"
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
    </Animated.View>
  );
}
