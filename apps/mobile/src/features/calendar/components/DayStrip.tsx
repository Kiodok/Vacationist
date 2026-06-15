import { useRef, useEffect, useCallback } from 'react';
import { FlatList, View, Platform } from 'react-native';
import type { SupportedTimezone } from '@vacationist/types';
import { DayCell } from './DayCell';

const ITEM_WIDTH = 52;
const ITEM_GAP = 4;
const ITEM_TOTAL = ITEM_WIDTH + ITEM_GAP;

interface DayStripProps {
  dateRange: string[];
  timezone: SupportedTimezone;
  selectedDate: string;
  activityCountByDate: Record<string, number>;
  onSelectDate: (date: string) => void;
}

export function DayStrip({
  dateRange,
  timezone,
  selectedDate,
  activityCountByDate,
  onSelectDate,
}: DayStripProps) {
  const listRef = useRef<FlatList>(null);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_TOTAL,
      offset: ITEM_TOTAL * index,
      index,
    }),
    [],
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const idx = dateRange.indexOf(selectedDate);
    if (idx >= 0 && listRef.current) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.4 });
      });
    }
  }, [selectedDate, dateRange]);

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <DayCell
        date={item}
        timezone={timezone}
        isSelected={item === selectedDate}
        hasActivities={(activityCountByDate[item] ?? 0) > 0}
        onPress={onSelectDate}
      />
    ),
    [timezone, selectedDate, activityCountByDate, onSelectDate],
  );

  return (
    <View className="bg-surface border-b border-border py-sm">
      <FlatList
        ref={listRef}
        data={dateRange}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        contentContainerStyle={{ paddingHorizontal: 16, gap: ITEM_GAP }}
        initialScrollIndex={Platform.OS === 'web' ? 0 : Math.max(0, dateRange.indexOf(selectedDate))}
        onScrollToIndexFailed={(info) => {
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.4 });
          });
        }}
      />
    </View>
  );
}
