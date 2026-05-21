import { View, Text } from 'react-native';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekdayHeader() {
  return (
    <View className="flex-row mb-xs">
      {WEEKDAYS.map((day) => (
        <View key={day} style={{ flex: 1, alignItems: 'center' }}>
          <Text className="text-label text-text-muted font-medium">{day}</Text>
        </View>
      ))}
    </View>
  );
}
