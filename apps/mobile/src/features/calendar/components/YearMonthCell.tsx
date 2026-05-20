import { View, Text, Pressable } from 'react-native';

interface YearMonthCellProps {
  monthIndex: number;
  monthLabel: string;
  hasActivities: boolean;
  hasTripOnly: boolean;
  isCurrentMonth: boolean;
  cellWidth: number;
  onPress: (monthIndex: number) => void;
}

export function YearMonthCell({
  monthIndex,
  monthLabel,
  hasActivities,
  hasTripOnly,
  isCurrentMonth,
  cellWidth,
  onPress,
}: YearMonthCellProps) {
  const dotClass = hasActivities
    ? 'bg-primary'
    : hasTripOnly
      ? 'bg-warning'
      : 'bg-transparent';

  return (
    <Pressable
      onPress={() => onPress(monthIndex)}
      style={({ pressed }) => ({
        width: cellWidth,
        opacity: pressed ? 0.7 : 1,
      })}
      className="items-center justify-center py-lg"
    >
      <View
        className={`rounded-md px-md py-sm items-center ${
          isCurrentMonth ? 'border border-primary' : ''
        }`}
      >
        <Text
          className={`text-heading-m font-medium ${
            isCurrentMonth ? 'text-primary' : 'text-text-primary'
          }`}
        >
          {monthLabel}
        </Text>
        <View className={`w-[5px] h-[5px] rounded-full mt-xs ${dotClass}`} />
      </View>
    </Pressable>
  );
}
