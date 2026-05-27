import { useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TransferVehicle, TransferVehiclePassenger } from '@vacationist/types';
import type { TripMemberWithUser } from '@vacationist/api';
import { colors } from '@vacationist/ui';

interface VehicleCardProps {
  vehicle: TransferVehicle;
  passengers: TransferVehiclePassenger[];
  members: TripMemberWithUser[];
  onPress: () => void;
  detail?: React.ReactNode;
  highlight?: boolean;
}

export function VehicleCard({ vehicle, passengers, members, onPress, detail, highlight }: VehicleCardProps) {
  const resolvedPassengers = passengers.map((p) => {
    const member = members.find((m) => m.user_id === p.user_id);
    return { ...p, name: member?.user?.name ?? 'Unknown' };
  });

  const borderColor = '#555555';
  const highlightAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (highlight) {
      const timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(highlightAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
        ]).start();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [highlight]);

  const animatedBorderColor = highlight
    ? highlightAnim.interpolate({ inputRange: [0, 1], outputRange: [borderColor, colors.primary] })
    : borderColor;

  return (
    <Animated.View
      className={`bg-surface ${detail ? 'rounded-t-md' : 'rounded-md'}`}
      style={{ borderWidth: 1, borderColor: animatedBorderColor, ...(Platform.OS === 'web' ? { borderStyle: 'solid' as const } : {}) }}
    >
      <Pressable
        onPress={onPress}
        className="p-md gap-sm"
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
