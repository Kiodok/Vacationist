import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TripMemberWithUser } from '@vacationist/api';

interface PassengerSelectSheetProps {
  visible: boolean;
  onClose: () => void;
  members: TripMemberWithUser[];
  selectedUserIds: string[];
  onConfirm: (userIds: string[]) => void;
  isPending: boolean;
  showDriverToggle?: boolean;
  driverUserIds?: string[];
  onDriverToggle?: (userId: string, isDriver: boolean) => void;
}

export function PassengerSelectSheet({
  visible,
  onClose,
  members,
  selectedUserIds,
  onConfirm,
  isPending,
  showDriverToggle = false,
  driverUserIds = [],
  onDriverToggle,
}: PassengerSelectSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedUserIds));

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm([...selected]);
  };

  const handleClose = () => {
    setSelected(new Set(selectedUserIds));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl max-h-[75%]">
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">Select Passengers</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">Cancel</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-xs">
              {members.map((member) => {
                const isSelected = selected.has(member.user_id);
                const isDriver = driverUserIds.includes(member.user_id);
                return (
                  <Pressable
                    key={member.user_id}
                    onPress={() => toggle(member.user_id)}
                    className={`flex-row items-center px-md py-sm rounded-md border ${
                      isSelected ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                    }`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View className={`w-[20px] h-[20px] rounded-sm border-2 items-center justify-center mr-md ${
                      isSelected ? 'bg-primary border-primary' : 'border-border'
                    }`}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </View>
                    <Text className="text-body text-text-primary flex-1">
                      {member.user?.name ?? 'Unknown'}
                    </Text>
                    {showDriverToggle && isSelected && onDriverToggle && (
                      <View className="flex-row items-center gap-xs">
                        <Text className="text-body-small text-text-muted">Driver</Text>
                        <Switch
                          value={isDriver}
                          onValueChange={(val) => onDriverToggle(member.user_id, val)}
                          thumbColor={isDriver ? '#6C63FF' : '#555555'}
                          trackColor={{ false: '#2E2E2E', true: '#6C63FF55' }}
                        />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Pressable
            onPress={handleConfirm}
            disabled={isPending}
            className={`items-center py-sm rounded-md mt-md ${isPending ? 'bg-primary/50' : 'bg-primary'}`}
            style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-white text-body font-semibold">
              {isPending ? 'Saving...' : `Confirm (${selected.size})`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
