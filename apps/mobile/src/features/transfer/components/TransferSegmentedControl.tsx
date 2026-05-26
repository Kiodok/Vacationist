import { View, Text, Pressable } from 'react-native';

export type TransferSegment = 'All' | 'Flights' | 'Vehicles' | 'Rentals';
const SEGMENTS: TransferSegment[] = ['All', 'Flights', 'Vehicles', 'Rentals'];

interface TransferSegmentedControlProps {
  activeSegment: TransferSegment;
  onSegmentChange: (segment: TransferSegment) => void;
}

export function TransferSegmentedControl({ activeSegment, onSegmentChange }: TransferSegmentedControlProps) {
  return (
    <View className="flex-row gap-xs px-md pt-md pb-sm">
      {SEGMENTS.map((segment) => {
        const isActive = segment === activeSegment;
        return (
          <Pressable
            key={segment}
            onPress={() => onSegmentChange(segment)}
            className={`px-md py-sm rounded-full ${isActive ? 'bg-primary' : 'bg-surface border border-border'}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className={`text-body-small font-medium ${isActive ? 'text-white' : 'text-text-secondary'}`}>
              {segment}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
