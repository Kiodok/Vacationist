import { ScrollView, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';
import type { PreworkTopic } from '@vacationist/types';

interface PreworkSegmentedControlProps {
  topics: PreworkTopic[];
  activeTopicId: string | null;
  onTopicChange: (topicId: string) => void;
  onAddTopic?: () => void;
}

export function PreworkSegmentedControl({
  topics,
  activeTopicId,
  onTopicChange,
  onAddTopic,
}: PreworkSegmentedControlProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerClassName="flex-row gap-xs px-md pt-sm pb-xs"
    >
      {topics.map((topic) => {
        const isActive = topic.id === activeTopicId;
        return (
          <Pressable
            key={topic.id}
            onPress={() => onTopicChange(topic.id)}
            className={`px-md py-sm rounded-full ${isActive ? 'bg-primary' : 'bg-surface border border-border'}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text
              className={`text-body-small font-medium ${isActive ? 'text-white' : 'text-text-secondary'}`}
              numberOfLines={1}
            >
              {topic.title}
            </Text>
          </Pressable>
        );
      })}

      {onAddTopic && (
        <Pressable
          onPress={onAddTopic}
          className="px-sm py-sm rounded-full bg-surface border border-border items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Ionicons name="add" size={18} color={colors.textSecondary} />
        </Pressable>
      )}
    </ScrollView>
  );
}
