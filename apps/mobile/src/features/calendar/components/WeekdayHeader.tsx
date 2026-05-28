import { View, Text } from 'react-native';
import { dayjs } from '@vacationist/utils';

// Mon=1 … Sat=6, Sun=0 — European week order (Mon first)
const WEEKDAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

export function WeekdayHeader() {
  const weekdays = WEEKDAY_INDICES.map((d) => dayjs().day(d).format('dd'));

  return (
    <View className="flex-row mb-xs">
      {weekdays.map((day, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
          <Text className="text-label text-text-muted font-medium">{day}</Text>
        </View>
      ))}
    </View>
  );
}
