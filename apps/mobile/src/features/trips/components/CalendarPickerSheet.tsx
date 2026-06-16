import { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { Calendar } from 'expo-calendar';
import { ThemedIcon, colors, useResolvedTheme } from '@vacationist/ui';

interface CalendarPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  calendars: Calendar[];
  isLoading: boolean;
  onConfirm: (calendarId: string) => void;
}

export function CalendarPickerSheet({
  visible,
  onClose,
  calendars,
  isLoading,
  onConfirm,
}: CalendarPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('trips');
  const { t: tCommon } = useTranslation('common');
  const theme = useResolvedTheme();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);

  function handleClose() {
    setSelectedCalendarId(null);
    onClose();
  }

  async function handleConfirm() {
    if (!selectedCalendarId || isLoading) return;
    await onConfirm(selectedCalendarId);
    setSelectedCalendarId(null);
  }

  const buttonTextColor = theme === 'colorful' ? colors.surface : '#ffffff';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
        <View
          className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[70%]"
          style={{ paddingBottom: Math.max(insets.bottom, 32) }}
        >
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">
              {t('overview.calendarPicker.title')}
            </Text>
            <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
            </Pressable>
          </View>

          {calendars.length === 0 ? (
            <Text className="text-body text-text-secondary text-center py-lg">
              {t('overview.calendarPicker.empty')}
            </Text>
          ) : (
            <FlatList
              data={calendars}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => {
                const selected = item.id === selectedCalendarId;
                return (
                  <Pressable
                    onPress={() => setSelectedCalendarId(item.id)}
                    className={`flex-row items-center p-md rounded-md mb-xs border ${
                      selected ? 'border-primary bg-primary/10' : 'border-border bg-surface'
                    }`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                  >
                    <View
                      className="w-[12px] h-[12px] rounded-full mr-sm flex-shrink-0"
                      style={{ backgroundColor: item.color ?? colors.primary }}
                    />
                    <View className="flex-1">
                      <Text className="text-body text-text-primary" numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.source?.name ? (
                        <Text className="text-body-small text-text-secondary" numberOfLines={1}>
                          {item.source.name}
                        </Text>
                      ) : null}
                    </View>
                    {selected && (
                      <ThemedIcon name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </Pressable>
                );
              }}
            />
          )}

          <Pressable
            onPress={handleConfirm}
            disabled={!selectedCalendarId || isLoading}
            className={`items-center py-sm rounded-md mt-md ${
              !selectedCalendarId || isLoading ? 'bg-primary/30' : 'bg-primary'
            }`}
            style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-body font-semibold" style={{ color: buttonTextColor }}>
              {isLoading ? t('overview.calendarPicker.adding') : t('overview.calendarPicker.confirm')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
