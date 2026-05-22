import { View, Text, Pressable, Modal, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NUDGE_MESSAGES } from '@vacationist/types';
import { useSendNudge } from '../hooks/useSendNudge';

interface NudgeSheetProps {
  tripId: string;
  visible: boolean;
  onClose: () => void;
}

export function NudgeSheet({ tripId, visible, onClose }: NudgeSheetProps) {
  const { mutate: sendNudge, isPending } = useSendNudge(tripId);

  const handleSelect = (title: string, body: string) => {
    sendNudge(
      { title, body },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-surface rounded-t-2xl">
          <View className="flex-row items-center justify-between px-lg pt-lg pb-md border-b border-border">
            <Text className="text-heading-s text-text-primary">Send a nudge</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#5C5C5C" />
            </Pressable>
          </View>

          <FlatList
            data={NUDGE_MESSAGES}
            keyExtractor={(item) => item.key}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item.title, item.body)}
                disabled={isPending}
                className="bg-background border border-border rounded-md p-md gap-xs active:opacity-70"
              >
                <Text className="text-body-default font-semibold text-text-primary">{item.title}</Text>
                <Text className="text-body-small text-text-secondary">{item.body}</Text>
              </Pressable>
            )}
            ListFooterComponent={
              isPending ? (
                <View className="items-center py-md">
                  <ActivityIndicator size="small" color="#6C63FF" />
                </View>
              ) : null
            }
          />
          <View className="h-8" />
        </View>
      </View>
    </Modal>
  );
}
