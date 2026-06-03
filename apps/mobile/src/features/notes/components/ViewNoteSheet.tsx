import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TripNote } from '@vacationist/types';

interface ViewNoteSheetProps {
  visible: boolean;
  note: TripNote;
  onClose: () => void;
}

export function ViewNoteSheet({ visible, note, onClose }: ViewNoteSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">Note</Text>
            <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-md">
              <Text className="text-body text-text-primary font-semibold">{note.title}</Text>
              {!!note.description && (
                <Text className="text-body text-text-secondary">{note.description}</Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
