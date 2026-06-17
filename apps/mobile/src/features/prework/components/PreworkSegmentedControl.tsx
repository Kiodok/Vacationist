import { ScrollView, View, Text, Pressable } from 'react-native';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
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
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const activeTextColor = isColorful ? colors.surface : '#ffffff';

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
              className={`text-body-small font-medium ${isActive ? '' : 'text-text-secondary'}`}
              style={isActive ? { color: activeTextColor } : undefined}
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
          <ThemedIcon name="add" size={18} color={colors.textSecondary} />
        </Pressable>
      )}
    </ScrollView>
  );
}
