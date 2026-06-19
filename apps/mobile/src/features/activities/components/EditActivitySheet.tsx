import { useEffect, useMemo } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { updateActivitySchemaForTrip, type UpdateActivityInput, type Activity, type Currency, ACTIVITY_CATEGORIES } from '@vacationist/types';
import { getCurrencySymbol } from '@vacationist/utils';
import { DateTimePickerField } from '../../../components/DateTimePickerField';
import { colors, useResolvedTheme } from '@vacationist/ui';

interface EditActivitySheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateActivityInput) => void;
  isPending: boolean;
  activity: Activity;
  currency: Currency;
  tripStartDate: string;
  tripEndDate: string;
}

export function EditActivitySheet({ visible, onClose, onSubmit, isPending, activity, currency, tripStartDate, tripEndDate }: EditActivitySheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('activities');
  const { t: tCommon } = useTranslation("common");
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const schema = useMemo(
    () => updateActivitySchemaForTrip(tripStartDate, tripEndDate),
    [tripStartDate, tripEndDate],
  );

  const { control, handleSubmit, reset, formState: { errors } } = useForm<UpdateActivityInput>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (visible) {
      reset({
        title: activity.title,
        description: activity.description ?? undefined,
        category: activity.category ?? undefined,
        cost_estimate: activity.cost_estimate ?? undefined,
        activity_date: activity.activity_date ?? undefined,
        start_time: activity.start_time ? activity.start_time.slice(0, 5) : undefined,
        end_time: activity.end_time ? activity.end_time.slice(0, 5) : undefined,
        external_url: activity.external_url ?? undefined,
        reservation_required: activity.reservation_required,
      });
    }
  }, [visible, activity]);

  const onValid = (data: UpdateActivityInput) => {
    onSubmit(data);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-background/80"
          onPress={onClose}
        />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          {/* Handle bar */}
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">{t('action.edit')}</Text>
            <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="gap-md">
              {/* Title */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.title')} *</Text>
                <Controller
                  control={control}
                  name="title"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder={t('placeholder.title')}
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      maxLength={100}
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
                      placeholder={t('placeholder.description')}
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      multiline
                      numberOfLines={3}
                      maxLength={1000}
                      style={{ minHeight: 80, textAlignVertical: 'top' }}
                    />
                  )}
                />
              </View>

              {/* Category */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.category')}</Text>
                <Controller
                  control={control}
                  name="category"
                  render={({ field: { onChange, value } }) => (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerClassName="gap-xs"
                    >
                      {ACTIVITY_CATEGORIES.map((cat) => (
                        <Pressable
                          key={cat}
                          onPress={() => onChange(value === cat ? undefined : cat)}
                          className={`px-md py-sm rounded-full ${
                            value === cat ? 'bg-primary' : 'bg-surface border border-border'
                          }`}
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                          <Text
                            className={`text-body-small ${
                              value === cat ? 'text-white font-semibold' : 'text-text-secondary'
                            }`}
                          >
                            {t(`category.${cat}`, { defaultValue: cat })}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                />
              </View>

              {/* Date */}
              <Controller
                control={control}
                name="activity_date"
                render={({ field: { onChange, value } }) => (
                  <DateTimePickerField
                    label={t('field.date')}
                    mode="date"
                    value={value}
                    onChange={onChange}
                    error={errors.activity_date?.message}
                    minimumDate={tripStartDate ? new Date(tripStartDate + 'T00:00:00') : undefined}
                    maximumDate={tripEndDate ? new Date(tripEndDate + 'T00:00:00') : undefined}
                  />
                )}
              />

              {/* Time row */}
              <View className="flex-row gap-sm">
                <View className="flex-1">
                  <Controller
                    control={control}
                    name="start_time"
                    render={({ field: { onChange, value } }) => (
                      <DateTimePickerField
                        label={t('field.startTime')}
                        mode="time"
                        value={value}
                        onChange={onChange}
                      />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Controller
                    control={control}
                    name="end_time"
                    render={({ field: { onChange, value } }) => (
                      <DateTimePickerField
                        label={t('field.endTime')}
                        mode="time"
                        value={value}
                        onChange={onChange}
                      />
                    )}
                  />
                </View>
              </View>

              {/* Cost Estimate */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.cost')} ({getCurrencySymbol(currency)})</Text>
                <Controller
                  control={control}
                  name="cost_estimate"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder="0.00"
                      value={value != null ? String(value) : ''}
                      onChangeText={(t) => {
                        const num = parseFloat(t);
                        onChange(isNaN(num) ? null : num);
                      }}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
              </View>

              {/* External URL */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.url')}</Text>
                <Controller
                  control={control}
                  name="external_url"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder="https://..."
                      value={value ?? ''}
                      onChangeText={(t) => onChange(t || null)}
                      autoCapitalize="none"
                      keyboardType="url"
                      maxLength={2048}
                    />
                  )}
                />
                {errors.external_url && (
                  <Text className="text-danger text-body-small">{errors.external_url.message}</Text>
                )}
              </View>

              {/* Reservation Required */}
              <Controller
                control={control}
                name="reservation_required"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row items-center justify-between py-xs">
                    <Text className="text-body text-text-primary">{t('field.reservationRequired')}</Text>
                    <Switch
                      value={value ?? false}
                      onValueChange={onChange}
                      trackColor={{ false: '#3E3E3E', true: colors.primary }}
                      thumbColor={isColorful ? colors.surface : '#FFFFFF'}
                      ios_backgroundColor="#3E3E3E"
                    />
                  </View>
                )}
              />

              {/* Submit */}
              <Pressable
                onPress={handleSubmit(onValid)}
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
