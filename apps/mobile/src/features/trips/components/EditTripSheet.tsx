import { useEffect } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { updateTripSchema, type UpdateTripInput, CURRENCY, SUPPORTED_TIMEZONES } from '@vacationist/types';
import type { Trip } from '@vacationist/types';
import { DateTimePickerField } from '../../../components/DateTimePickerField';

interface EditTripSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateTripInput) => void;
  isPending: boolean;
  trip: Trip & { member_count: number };
}

export function EditTripSheet({ visible, onClose, onSubmit, isPending, trip }: EditTripSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('trips');
  const { t: tCommon } = useTranslation("common");
  const { control, handleSubmit, reset, formState: { errors } } = useForm<UpdateTripInput>({
    resolver: zodResolver(updateTripSchema),
  });

  useEffect(() => {
    if (visible) {
      reset({
        title: trip.title,
        description: trip.description ?? undefined,
        start_date: trip.start_date,
        end_date: trip.end_date,
        budget_per_person: trip.budget_per_person ?? null,
        base_currency: trip.base_currency as typeof CURRENCY[number],
        timezone: trip.timezone as typeof SUPPORTED_TIMEZONES[number],
      });
    }
  }, [visible, trip]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[92%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
            {/* Handle bar */}
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">{t('overview.editTrip')}</Text>
              <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-md">
                {/* Title */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('field.tripName')} *</Text>
                  <Controller
                    control={control}
                    name="title"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="e.g. Summer in Portugal"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        maxLength={100}
                        autoCapitalize="sentences"
                      />
                    )}
                  />
                  {errors.title && (
                    <Text className="text-danger text-body-small">{errors.title.message}</Text>
                  )}
                </View>

                {/* Description */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('field.description')}</Text>
                  <Controller
                    control={control}
                    name="description"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="What's this trip about?"
                        value={value ?? ''}
                        onChangeText={(t) => onChange(t || null)}
                        onBlur={onBlur}
                        multiline
                        numberOfLines={3}
                        maxLength={1000}
                        style={{ minHeight: 80, textAlignVertical: 'top' }}
                      />
                    )}
                  />
                </View>

                {/* Dates */}
                <View className="flex-row gap-md">
                  <View className="flex-1">
                    <Controller
                      control={control}
                      name="start_date"
                      render={({ field: { onChange, value } }) => (
                        <DateTimePickerField
                          label={t('field.startDate')}
                          mode="date"
                          value={value}
                          onChange={(v) => onChange(v ?? '')}
                          error={errors.start_date?.message}
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1">
                    <Controller
                      control={control}
                      name="end_date"
                      render={({ field: { onChange, value } }) => (
                        <DateTimePickerField
                          label={t('field.endDate')}
                          mode="date"
                          value={value}
                          onChange={(v) => onChange(v ?? '')}
                          error={errors.end_date?.message}
                        />
                      )}
                    />
                  </View>
                </View>

                {/* Budget + Currency */}
                <View className="flex-row gap-md">
                  <View className="flex-1">
                    <View className="gap-xs">
                      <Text className="text-label text-text-muted uppercase">{t('field.budget')}</Text>
                      <Controller
                        control={control}
                        name="budget_per_person"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextInput
                            className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                            placeholderTextColor="#5C5C5C"
                            placeholder="0.00"
                            value={value != null ? String(value) : ''}
                            onChangeText={(t) => {
                              const num = parseFloat(t);
                              onChange(isNaN(num) ? null : num);
                            }}
                            onBlur={onBlur}
                            keyboardType="decimal-pad"
                          />
                        )}
                      />
                      {errors.budget_per_person && (
                        <Text className="text-danger text-body-small">{errors.budget_per_person.message}</Text>
                      )}
                    </View>
                  </View>
                  <View className="flex-1">
                    <Controller
                      control={control}
                      name="base_currency"
                      render={({ field: { value, onChange } }) => (
                        <View className="gap-xs">
                          <Text className="text-label text-text-muted uppercase">{t('field.currency')}</Text>
                          <View className="flex-row gap-sm">
                            {CURRENCY.map((c) => (
                              <Pressable
                                key={c}
                                onPress={() => onChange(c)}
                                className={`flex-1 min-h-[48px] rounded-sm items-center justify-center border ${
                                  value === c ? 'bg-primary border-primary' : 'bg-surface border-border'
                                }`}
                              >
                                <Text
                                  className={`text-body font-semibold ${
                                    value === c ? 'text-white' : 'text-text-secondary'
                                  }`}
                                >
                                  {c}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      )}
                    />
                  </View>
                </View>

                {/* Timezone */}
                <Controller
                  control={control}
                  name="timezone"
                  render={({ field: { value, onChange } }) => (
                    <View className="gap-xs">
                      <Text className="text-label text-text-muted uppercase">{t('field.timezone')}</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerClassName="gap-sm"
                        keyboardShouldPersistTaps="handled"
                      >
                        {SUPPORTED_TIMEZONES.map((tz) => {
                          const label = tz.replace('Europe/', '');
                          return (
                            <Pressable
                              key={tz}
                              onPress={() => onChange(tz)}
                              className={`px-md min-h-[40px] rounded-full items-center justify-center border ${
                                value === tz ? 'bg-primary border-primary' : 'bg-surface border-border'
                              }`}
                            >
                              <Text
                                className={`text-body-small ${
                                  value === tz ? 'text-white font-semibold' : 'text-text-secondary'
                                }`}
                              >
                                {label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                />

                {/* Submit */}
                <Pressable
                  onPress={handleSubmit(onSubmit)}
                  disabled={isPending}
                  className={`items-center py-sm rounded-md mt-sm ${
                    isPending ? 'bg-primary/50' : 'bg-primary'
                  }`}
                  style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-white text-body font-semibold">
                    {isPending ? tCommon('label.saving') : tCommon('button.save')}
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
