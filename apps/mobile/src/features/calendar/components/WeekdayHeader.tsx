import { View, Text } from 'react-native';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WeekdayHeaderProps {
  cellSize: number;
}

export function WeekdayHeader({ cellSize }: WeekdayHeaderProps) {
  return (
    <View className="flex-row mb-xs">
      {WEEKDAYS.map((day) => (
        <View key={day} style={{ width: cellSize }} className="items-center">
          <Text className="text-label text-text-muted font-medium">{day}</Text>
        </View>
      ))}
    </View>
  );
}
