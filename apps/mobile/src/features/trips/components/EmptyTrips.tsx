import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, colors } from '@vacationist/ui';

interface EmptyTripsProps {
  onCreateTrip: () => void;
}

export function EmptyTrips({ onCreateTrip }: EmptyTripsProps) {
  return (
    <View className="flex-1 items-center justify-center px-xl">
      <View className="w-[80px] h-[80px] rounded-full bg-primary-muted items-center justify-center mb-lg">
        <Ionicons name="airplane-outline" size={36} color={colors.primary} />
      </View>
      <Text className="text-heading-l text-text-primary text-center mb-sm">
        No trips yet
      </Text>
      <Text className="text-body text-text-secondary text-center mb-xl">
        Create your first trip and start planning with your group.
      </Text>
      <Button label="Create a Trip" onPress={onCreateTrip} />
    </View>
  );
}
