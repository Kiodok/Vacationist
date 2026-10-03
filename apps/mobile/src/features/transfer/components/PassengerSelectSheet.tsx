import { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TripMemberWithUser } from '@vacationist/api';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { BoundedVirtualList } from '../../../components/BoundedVirtualList';
import { SwipeToDismiss } from '../../../components/SwipeToDismiss';

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
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedUserIds));

  // Re-seed from the latest server state on the closed→open transition only. Every parent
  // rebuilds selectedUserIds via .map() on every render, so depending on it directly would
  // re-seed on every parent re-render while the sheet is already open, silently discarding
  // whatever the user is mid-selecting. [visible] alone only fires on open/close, and this
  // closure still sees that render's current selectedUserIds — exactly what we want. Without
  // this, the sheet's checkbox state was seeded once at mount (often before the passenger query
  // had even resolved) and never resynced, so a just-joined passenger silently reset to
  // unchecked every time the sheet was reopened.
  useEffect(() => {
    if (visible) {
      setSelected(new Set(selectedUserIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
      <SwipeToDismiss
          onDismiss={handleClose}
          className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[75%]"
          style={{ paddingBottom: Math.max(insets.bottom, 32) + 16 }}
        >
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">Select Passengers</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">Cancel</Text>
            </Pressable>
          </View>

          <BoundedVirtualList
            data={members}
            keyExtractor={(member) => member.user_id}
            itemHeight={56}
            scrollable
            renderItem={(member) => {
              const isSelected = selected.has(member.user_id);
              const isDriver = driverUserIds.includes(member.user_id);
              return (
                // The row itself is NOT a Pressable — the driver Switch must be a sibling, never
                // a descendant, of the selection Pressable. Nesting it caused a tap on the
                // Switch to also fire the row's onPress (DOM click-bubbling through Switch's
                // underlying <input> on web), deselecting the member and unmounting the Switch
                // out from under the tap. Same bug class, same fix (siblings, not ancestor/
                // descendant) as DateTimePickerField.tsx's backdrop/panel split — that file's
                // comment also explains why `onStartShouldSetResponder` to "swallow" the touch
                // is the wrong fix: it makes JS claim touches meant for the native control.
                <View
                  className={`flex-row items-center px-md py-sm rounded-md border mb-xs ${
                    isSelected ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                  }`}
                >
                  <Pressable
                    onPress={() => toggle(member.user_id)}
                    className="flex-row items-center flex-1"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View className={`w-[20px] h-[20px] rounded-sm border-2 items-center justify-center mr-md ${
                      isSelected ? 'bg-primary border-primary' : 'border-border'
                    }`}>
                      {isSelected && <ThemedIcon name="checkmark" size={14} color={isColorful ? colors.surface : '#FFFFFF'} />}
                    </View>
                    <Text className="text-body text-text-primary flex-1">
                      {member.user?.name ?? 'Unknown'}
                    </Text>
                  </Pressable>
                  {/* Only once the member is a genuinely persisted passenger (selectedUserIds is
                      the live server-backed prop — not the local, possibly-unconfirmed `selected`
                      state): toggling is_driver on a row that doesn't exist in
                      transfer_vehicle_passengers yet is a guaranteed PGRST116 failure. */}
                  {showDriverToggle && isSelected && selectedUserIds.includes(member.user_id) && onDriverToggle && (
                    <View className="flex-row items-center gap-xs">
                      <Text className="text-body-small text-text-muted">Driver</Text>
                      <Switch
                        value={isDriver}
                        onValueChange={(val) => onDriverToggle(member.user_id, val)}
                        trackColor={{ false: '#3E3E3E', true: isColorful ? colors.surface : colors.primary }}
                        thumbColor={isColorful ? colors.surfaceElevated : '#FFFFFF'}
                      />
                    </View>
                  )}
                </View>
              );
            }}
          />

          <Pressable
            onPress={handleConfirm}
            disabled={isPending}
            className={`items-center py-sm rounded-md mt-md ${isPending ? 'bg-primary/50' : 'bg-primary'}`}
            style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-body font-semibold" style={{ color: isColorful ? colors.surface : '#FFFFFF' }}>
              {isPending ? 'Saving...' : `Confirm (${selected.size})`}
            </Text>
          </Pressable>
        </SwipeToDismiss>
    </Modal>
  );
}
