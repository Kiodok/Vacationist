import { View, Text, Pressable } from 'react-native';
import { useThemeColors } from '@vacationist/ui';

const TRIP_COVERAGE_DOT = '#f87a6e';

interface YearMonthCellProps {
  monthIndex: number;
  monthLabel: string;
  activityDots: number;
  tripOnlyDots: number;
  isCurrentMonth: boolean;
  onPress: (monthIndex: number) => void;
}

export function YearMonthCell({
  monthIndex,
  monthLabel,
  activityDots,
  tripOnlyDots,
  isCurrentMonth,
  onPress,
}: YearMonthCellProps) {
  const tc = useThemeColors();
  const dots: string[] = [];
  for (let i = 0; i < activityDots; i++) dots.push('activity');
  for (let i = 0; i < tripOnlyDots; i++) dots.push('tripOnly');

  return (
    <View style={{ flex: 1 }}>
      <Pressable
        onPress={() => onPress(monthIndex)}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
          <View
            className={`rounded-md px-md py-sm items-center border ${
              isCurrentMonth
                ? 'border-primary bg-primary/10'
                : 'border-border/50'
            }`}
          >
            <Text
              className={`text-heading-m font-medium ${
                isCurrentMonth ? 'text-primary' : 'text-text-primary'
              }`}
            >
              {monthLabel}
            </Text>
            <View className="flex-row items-center justify-center gap-xs mt-xs" style={{ minHeight: 5 }}>
              {dots.map((type, i) => (
                <View
                  key={i}
                  className="w-[5px] h-[5px] rounded-full"
                  style={{ backgroundColor: type === 'activity' ? tc.primary : TRIP_COVERAGE_DOT }}
                />
              ))}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
