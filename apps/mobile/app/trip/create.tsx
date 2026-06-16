import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button, Input , ThemedIcon } from '@vacationist/ui';
import { createTripSchema, CURRENCY, SUPPORTED_TIMEZONES } from '@vacationist/types';
import type { CreateTripInput } from '@vacationist/types';
import { useCreateTrip } from '../../src/features/trips/hooks/useTrips';
import { DateTimePickerField } from '../../src/components/DateTimePickerField';

export default function CreateTripScreen() {
  const { t } = useTranslation('trips');
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();
  const createTrip = useCreateTrip();
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<CreateTripInput>({
    resolver: zodResolver(createTripSchema),
    defaultValues: {
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      budget_per_person: null,
      base_currency: 'EUR',
      timezone: 'Europe/Berlin',
    },
  });

  async function onSubmit(data: CreateTripInput) {
    try {
      const trip = await createTrip.mutateAsync(data);
      router.replace({ pathname: '/trip/[id]', params: { id: trip.id } } as never);
    } catch {
      // Error feedback handled by mutation onError callback
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-md pt-md pb-sm gap-md">
        <Pressable onPress={() => router.back()} className="p-xs">
          <ThemedIcon name="arrow-back" size={24} color="#F2F2F2" />
        </Pressable>
        <Text className="text-heading-l text-text-primary flex-1">{t('create.title')}</Text>
      </View>

      <ScrollView contentContainerClassName="px-md pb-3xl gap-md">
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('field.tripName')}
              placeholder={t('create.namePlaceholder')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.title?.message}
              autoCapitalize="sentences"
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={`${t('field.description')} ${tCommon('label.optional')}`}
              placeholder={t('create.descriptionPlaceholder')}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.description?.message}
              multiline
              numberOfLines={3}
            />
          )}
        />

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

        <View className="flex-row gap-md">
          <View className="flex-1">
            <Controller
              control={control}
              name="budget_per_person"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={`${t('field.budget')} ${tCommon('label.optional')}`}
                  placeholder={t('create.budgetPlaceholder')}
                  value={value != null ? String(value) : ''}
                  onChangeText={(text) => {
                    const num = parseFloat(text);
                    onChange(isNaN(num) ? null : num);
                  }}
                  onBlur={onBlur}
                  error={errors.budget_per_person?.message}
                  keyboardType="decimal-pad"
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="base_currency"
              render={({ field: { value, onChange } }) => (
                <View>
                  <Text className="text-label text-text-muted uppercase mb-xs">{t('field.currency')}</Text>
                  <Pressable
                    onPress={() => setShowCurrencyPicker((v) => !v)}
                    className="bg-surface border border-border rounded-sm px-md flex-row items-center justify-between min-h-[48px]"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Text className="text-body font-semibold text-text-primary">{value}</Text>
                    <ThemedIcon name={showCurrencyPicker ? 'chevron-up' : 'chevron-down'} size={16} color="#9E9E9E" />
                  </Pressable>
                  {showCurrencyPicker && (
                    <View className="bg-surface border border-border rounded-sm mt-xs overflow-hidden">
                      {CURRENCY.map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => { onChange(c); setShowCurrencyPicker(false); }}
                          className="px-md py-sm flex-row items-center justify-between"
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, backgroundColor: value === c ? 'rgba(108,99,255,0.12)' : 'transparent' })}
                        >
                          <Text className={`text-body ${value === c ? 'text-primary font-semibold' : 'text-text-primary'}`}>{c}</Text>
                          {value === c && <ThemedIcon name="checkmark" size={16} color="#6C63FF" />}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="timezone"
          render={({ field: { value, onChange } }) => (
            <View>
              <Text className="text-label text-text-muted uppercase mb-xs">{t('field.timezone')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-sm"
              >
                {SUPPORTED_TIMEZONES.map((tz) => {
                  const label = tz.replace('Europe/', '');
                  return (
                    <Pressable
                      key={tz}
                      onPress={() => onChange(tz)}
                      className={`px-md min-h-[40px] rounded-full items-center justify-center border ${
                        value === tz
                          ? 'bg-primary border-primary'
                          : 'bg-surface border-border'
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

        <View className="mt-md">
          <Button
            label={t('create.submit')}
            onPress={handleSubmit(onSubmit)}
            loading={createTrip.isPending}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
