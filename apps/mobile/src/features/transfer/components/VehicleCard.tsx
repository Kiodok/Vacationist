import { useState } from 'react';
import { View, Text, Pressable, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TransferVehicle, TransferVehiclePassenger } from '@vacationist/types';
import type { TripMemberWithUser } from '@vacationist/api';
import { colors } from '@vacationist/ui';
import { useHighlightAnimation } from '../../../hooks/useHighlightAnimation';

interface VehicleCardProps {
  vehicle: TransferVehicle;
  passengers: TransferVehiclePassenger[];
  members: TripMemberWithUser[];
  onPress: () => void;
  detail?: React.ReactNode;
  highlight?: boolean;
  joinAction?: React.ReactNode;
}

export function VehicleCard({ vehicle, passengers, members, onPress, detail, highlight, joinAction }: VehicleCardProps) {
  const resolvedPassengers = passengers.map((p) => {
    const member = members.find((m) => m.user_id === p.user_id);
    return { ...p, name: member?.user?.name ?? 'Unknown' };
  });

  const [notesExpanded, setNotesExpanded] = useState(false);
  const borderColor = colors.border;
  const { animatedBorderColor } = useHighlightAnimation(highlight, borderColor);

  return (
    <Animated.View
      className={`bg-surface ${detail ? 'rounded-t-md' : joinAction ? 'rounded-t-md' : 'rounded-md'}`}
      style={{ borderWidth: 1, borderColor: animatedBorderColor, ...(Platform.OS === 'web' ? { borderStyle: 'solid' as const } : {}) }}
    >
      <Pressable
        onPress={onPress}
        className={`px-md pt-md gap-sm ${vehicle.notes ? 'pb-sm' : 'pb-md'}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 gap-xs">
            <Text className="text-body text-text-primary font-semibold" numberOfLines={1}>
              {vehicle.title}
            </Text>
          </View>
          <DirectionBadge direction={vehicle.direction} />
        </View>

        {resolvedPassengers.length > 0 && (
          <View className="flex-row flex-wrap gap-xs">
            {resolvedPassengers.map((p) => (
              <View key={p.id} className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-surface-elevated border border-border">
                {p.is_driver && <Ionicons name="car-outline" size={12} color={colors.primary} />}
                <Text className={`text-body-small ${p.is_driver ? 'text-primary font-medium' : 'text-text-secondary'}`}>
                  {p.name}
                </Text>
              </View>
            ))}
          </View>
        )}

        {resolvedPassengers.length === 0 && (
          <Text className="text-body-small text-text-muted">No passengers assigned</Text>
        )}
      </Pressable>

      {/* Notes live outside the card Pressable so their touch target doesn't conflict */}
      {vehicle.notes ? (
        <Pressable
          onPress={() => setNotesExpanded((v) => !v)}
          className="px-md pb-md"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text
            className="text-body-small text-text-secondary"
            numberOfLines={notesExpanded ? undefined : 2}
          >
            {vehicle.notes}
          </Text>
        </Pressable>
      ) : null}

      {joinAction}
      {detail}
    </Animated.View>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  if (direction === 'outbound-return') {
    return (
      <View className="px-sm py-xs rounded-full bg-success/10">
        <Text className="text-label font-medium text-success">Outbound + Return</Text>
      </View>
    );
  }
  return (
    <View className={`px-sm py-xs rounded-full ${direction === 'outbound' ? 'bg-primary/10' : 'bg-warning/10'}`}>
      <Text className={`text-label font-medium ${direction === 'outbound' ? 'text-primary' : 'text-warning'}`}>
        {direction === 'outbound' ? 'Outbound' : 'Return'}
      </Text>
    </View>
  );
}
