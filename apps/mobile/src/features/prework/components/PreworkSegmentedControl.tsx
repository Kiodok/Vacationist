import type { PreworkTopic } from '@vacationist/types';
import { SegmentedControl } from '../../../components/SegmentedControl';

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
    <SegmentedControl
      segments={topics.map((topic) => ({ key: topic.id, label: topic.title }))}
      activeKey={activeTopicId ?? ''}
      onChange={onTopicChange}
      trailingAction={onAddTopic ? { icon: 'add', onPress: onAddTopic } : undefined}
    />
  );
}
