import { useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
] as const;

interface DocumentAccessRequestSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (durationMinutes: number) => void;
  isPending: boolean;
}

export function DocumentAccessRequestSheet({
  visible,
  onClose,
  onSubmit,
  isPending,
}: DocumentAccessRequestSheetProps) {
  const [selected, setSelected] = useState<number>(30);

  const handleSubmit = () => {
    onSubmit(selected);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl">
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary font-semibold">Request Documents</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text className="text-body text-text-secondary">Cancel</Text>
            </Pressable>
          </View>

          <View className="bg-surface border border-border rounded-md p-md mb-lg gap-xs">
            <View className="flex-row items-center gap-xs">
              <Ionicons name="information-circle-outline" size={16} color="#A0A0A0" />
              <Text className="text-body-small text-text-secondary font-medium">How it works</Text>
            </View>
            <Text className="text-body-small text-text-muted">
              Each member will receive a request to share their travel documents. They can choose
              to grant or deny. You will only see documents from members who grant access, and only
              within the time window you choose.
            </Text>
          </View>

          <Text className="text-label text-text-muted uppercase mb-sm">Access Duration</Text>
          <View className="flex-row gap-sm mb-lg">
            {DURATION_OPTIONS.map(({ value, label }) => (
              <Pressable
                key={value}
                onPress={() => setSelected(value)}
                className={`flex-1 min-h-[48px] rounded-sm border items-center justify-center ${
                  selected === value
                    ? 'bg-primary/20 border-primary'
                    : 'bg-surface border-border'
                }`}
              >
                <Text
                  className={`text-body font-medium ${
                    selected === value ? 'text-primary' : 'text-text-secondary'
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={isPending}
            className={`min-h-[48px] rounded-sm items-center justify-center ${
              isPending ? 'bg-primary/50' : 'bg-primary'
            }`}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-body text-white font-semibold">Send Request</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
