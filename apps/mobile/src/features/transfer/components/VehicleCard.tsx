import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TransferVehicle, TransferVehiclePassenger } from '@vacationist/types';
import type { TripMemberWithUser } from '@vacationist/api';

interface VehicleCardProps {
  vehicle: TransferVehicle;
  passengers: TransferVehiclePassenger[];
  members: TripMemberWithUser[];
  onPress: () => void;
  detail?: React.ReactNode;
}

export function VehicleCard({ vehicle, passengers, members, onPress, detail }: VehicleCardProps) {
  const resolvedPassengers = passengers.map((p) => {
    const member = members.find((m) => m.user_id === p.user_id);
    return { ...p, name: member?.user?.name ?? 'Unknown' };
  });

  return (
    <View className={`bg-surface border border-border ${detail ? 'rounded-t-md' : 'rounded-md'}`}>
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
                {p.is_driver && <Ionicons name="car-outline" size={12} color="#6C63FF" />}
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
    </View>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  return (
    <View className={`px-sm py-xs rounded-full ${direction === 'outbound' ? 'bg-primary/10' : 'bg-warning/10'}`}>
      <Text className={`text-label font-medium ${direction === 'outbound' ? 'text-primary' : 'text-warning'}`}>
        {direction === 'outbound' ? 'Outbound' : 'Return'}
      </Text>
    </View>
  );
}
