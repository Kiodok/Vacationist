import { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, ScrollView, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DateTimePickerField } from '../../../components/DateTimePickerField';

interface BookAccommodationSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (checkIn: string, checkOut: string) => void;
  isPending: boolean;
  initialCheckIn: string | null | undefined;
  initialCheckOut: string | null | undefined;
  tripStartDate: string | null | undefined;
  tripEndDate: string | null | undefined;
}

export function BookAccommodationSheet({
  visible,
  onClose,
  onSubmit,
  isPending,
  initialCheckIn,
  initialCheckOut,
  tripStartDate,
  tripEndDate,
}: BookAccommodationSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('accommodations');
  const { t: tCommon } = useTranslation('common');

  const [checkIn, setCheckIn] = useState<string | null>(initialCheckIn ?? tripStartDate ?? null);
  const [checkOut, setCheckOut] = useState<string | null>(initialCheckOut ?? tripEndDate ?? null);

  // Reset to the accommodation's saved dates (or trip defaults) each time the sheet
  // opens — and re-sync if the dates arrive after the sheet is already open
  // (the trip query may still be loading when the user taps "Book").
  useEffect(() => {
    if (visible) {
      setCheckIn(initialCheckIn ?? tripStartDate ?? null);
      setCheckOut(initialCheckOut ?? tripEndDate ?? null);
    }
  }, [visible, initialCheckIn, initialCheckOut, tripStartDate, tripEndDate]);

  // 'T00:00:00' forces local-time parsing — a bare 'YYYY-MM-DD' parses as UTC
  // midnight, which shifts the picker bounds a day backward west of UTC.
  const minDate = tripStartDate ? new Date(tripStartDate + 'T00:00:00') : undefined;
  const maxDate = tripEndDate ? new Date(tripEndDate + 'T00:00:00') : undefined;

  const dateOrderError = !!(checkIn && checkOut && checkOut <= checkIn);

  const handleSubmit = () => {
    if (!checkIn || !checkOut || dateOrderError) return;
    onSubmit(checkIn, checkOut);
  };

  const isDisabled = isPending || !checkIn || !checkOut || dateOrderError;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">{t('action.book')}</Text>
              <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-md">
                <DateTimePickerField
                  label={t('field.checkIn')}
                  value={checkIn}
                  onChange={setCheckIn}
                  mode="date"
                  minimumDate={minDate}
                  maximumDate={maxDate}
                />
                <DateTimePickerField
                  label={t('field.checkOut')}
                  value={checkOut}
                  onChange={setCheckOut}
                  mode="date"
                  minimumDate={minDate}
                  maximumDate={maxDate}
                />

                {dateOrderError && (
                  <Text className="text-danger text-body-small">{t('error.checkOutBeforeCheckIn')}</Text>
                )}

                <Pressable
                  onPress={handleSubmit}
                  disabled={isDisabled}
                  className={`items-center py-sm rounded-md ${isDisabled ? 'bg-primary/50' : 'bg-primary'}`}
                  style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-white text-body font-semibold">
                    {isPending ? tCommon('label.saving') : t('action.book')}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
