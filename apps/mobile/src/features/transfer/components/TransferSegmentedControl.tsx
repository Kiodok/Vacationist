import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, useResolvedTheme } from '@vacationist/ui';

export type TransferSegment = 'All' | 'Flights' | 'Vehicles' | 'Rentals';
const SEGMENTS: TransferSegment[] = ['All', 'Flights', 'Vehicles', 'Rentals'];

const SEGMENT_KEY: Record<TransferSegment, string> = {
  All: 'segment.all',
  Flights: 'segment.flights',
  Vehicles: 'segment.vehicles',
  Rentals: 'segment.rentals',
};

interface TransferSegmentedControlProps {
  activeSegment: TransferSegment;
  onSegmentChange: (segment: TransferSegment) => void;
}

export function TransferSegmentedControl({ activeSegment, onSegmentChange }: TransferSegmentedControlProps) {
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { t } = useTranslation('transfer');

  const getLabel = (segment: TransferSegment): string => {
    switch (segment) {
      case 'All':      return t('segment.all');
      case 'Flights':  return t('segment.flights');
      case 'Vehicles': return t('segment.vehicles');
      case 'Rentals':  return t('segment.rentals');
    }
  };

  return (
    <View className="flex-row gap-xs px-md pt-sm pb-xs">
      {SEGMENTS.map((segment) => {
        const isActive = segment === activeSegment;
        return (
          <Pressable
            key={segment}
            onPress={() => onSegmentChange(segment)}
            className={`px-md py-sm rounded-full ${isActive ? 'bg-primary' : 'bg-surface border border-border'}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text
              className={`text-body-small font-medium ${isActive ? 'text-white' : 'text-text-secondary'}`}
              style={isActive && isColorful ? { color: colors.surfaceElevated } : undefined}
            >
              {getLabel(segment)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
