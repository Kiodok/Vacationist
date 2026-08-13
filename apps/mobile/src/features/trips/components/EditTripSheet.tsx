import { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { ScrollView } from '@vacationist/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { updateTripSchema, type UpdateTripInput, SUPPORTED_TIMEZONES } from '@vacationist/types';
import type { Trip } from '@vacationist/types';
import { DateTimePickerField } from '../../../components/DateTimePickerField';
import { ThemedIcon, colors, useResolvedTheme } from '@vacationist/ui';
import { useCurrencies } from '../../currencies/hooks/useCurrencies';
import { useExpenses } from '../../expenses/hooks/useExpenses';

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
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const { data: currencies = [] } = useCurrencies();
  // base_currency is locked once the trip has any expenses (enforced DB-side by
  // restrict_trip_base_currency_update — see 20260809100005_lock_base_currency_after_expense.sql).
  // This is the UX-side heads-up so the picker never shows a value the server will reject.
  const { data: expensesData } = useExpenses(trip.id);
  const hasExpenses = (expensesData?.pages[0]?.items.length ?? 0) > 0;
  const { control, handleSubmit, reset, formState: { errors } } = useForm<UpdateTripInput>({
    resolver: zodResolver(updateTripSchema),
  });

  const filteredCurrencies = currencyQuery.trim()
    ? currencies.filter(
        (c) =>
          c.code.toLowerCase().includes(currencyQuery.trim().toLowerCase()) ||
          c.name.toLowerCase().includes(currencyQuery.trim().toLowerCase()),
      )
    : currencies;

  useEffect(() => {
    if (!visible) { setShowCurrencyPicker(false); setCurrencyQuery(''); }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      reset({
        title: trip.title,
        description: trip.description ?? undefined,
        start_date: trip.start_date,
        end_date: trip.end_date,
        budget_per_person: trip.budget_per_person ?? null,
        base_currency: trip.base_currency,
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
                  <Text className="text-label text-text-muted uppercase">
                    {t('field.tripName')}<Text className="text-danger"> *</Text>
                  </Text>
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
                          required
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
                          required
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
                            className="min-h-[48px] bg-surface border border-border rounded-sm px-md text-text-primary text-body"
                            placeholderTextColor="#5C5C5C"
                            placeholder="0.00"
                            value={value != null ? String(value) : ''}
                            onChangeText={(t) => {
                              const num = parseFloat(t.replace(',', '.'));
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
                          <Text className="text-label text-text-muted uppercase">
                            {t('field.currency')}<Text className="text-danger"> *</Text>
                          </Text>
                          {hasExpenses ? (
                            <View className="bg-surface border border-border rounded-sm px-md flex-row items-center justify-between min-h-[48px] opacity-60">
                              <Text className="text-body font-semibold text-text-primary">{value}</Text>
                              <ThemedIcon name="lock-closed-outline" size={14} color={colors.textMuted} />
                            </View>
                          ) : (
                            <>
                              <Pressable
                                onPress={() => setShowCurrencyPicker((v) => !v)}
                                className="bg-surface border border-border rounded-sm px-md flex-row items-center justify-between min-h-[48px]"
                                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                              >
                                <Text className="text-body font-semibold text-text-primary">{value}</Text>
                                <ThemedIcon name={showCurrencyPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                              </Pressable>
                              {showCurrencyPicker && (
                                <View className="bg-surface border border-border rounded-sm mt-xs overflow-hidden">
                                  <View className="px-sm py-xs border-b border-border">
                                    <TextInput
                                      className="text-body-small text-text-primary px-sm py-xs"
                                      placeholder={t('field.currencySearch')}
                                      placeholderTextColor={colors.textMuted}
                                      value={currencyQuery}
                                      onChangeText={setCurrencyQuery}
                                      autoCapitalize="characters"
                                      autoCorrect={false}
                                    />
                                  </View>
                                  <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                    {filteredCurrencies.map((c) => (
                                      <Pressable
                                        key={c.code}
                                        onPress={() => { onChange(c.code); setShowCurrencyPicker(false); setCurrencyQuery(''); }}
                                        className="px-md py-sm flex-row items-center justify-between"
                                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, backgroundColor: value === c.code ? `${colors.primary}1F` : 'transparent' })}
                                      >
                                        <View className="flex-1 flex-row items-center gap-xs">
                                          <Text className={`text-body ${value === c.code ? 'text-primary font-semibold' : 'text-text-primary'}`}>{c.code}</Text>
                                          <Text className="text-body-small text-text-secondary flex-1" numberOfLines={1}>{c.name}</Text>
                                        </View>
                                        {value === c.code && <ThemedIcon name="checkmark" size={16} color={colors.primary} />}
                                      </Pressable>
                                    ))}
                                  </ScrollView>
                                </View>
                              )}
                            </>
                          )}
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
                      <Text className="text-label text-text-muted uppercase">
                        {t('field.timezone')}<Text className="text-danger"> *</Text>
                      </Text>
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
                  <Text className="text-white text-body font-semibold" style={isColorful ? { color: colors.surface } : undefined}>
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
