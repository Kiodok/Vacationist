import { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { createAccommodationSchema, type CreateAccommodationInput } from '@vacationist/types';
import { DateTimePickerField } from '../../../components/DateTimePickerField';
import { colors, useResolvedTheme } from '@vacationist/ui';

interface CreateAccommodationSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAccommodationInput) => void;
  isPending: boolean;
  currency: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
}

export function CreateAccommodationSheet({ visible, onClose, onSubmit, isPending, currency, tripStartDate, tripEndDate }: CreateAccommodationSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('accommodations');
  const { t: tCommon } = useTranslation("common");
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const [priceText, setPriceText] = useState('');
  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateAccommodationInput>({
    resolver: zodResolver(createAccommodationSchema),
    defaultValues: {
      title: '',
      auto_close: false,
      check_in_date: tripStartDate ?? undefined,
      check_out_date: tripEndDate ?? undefined,
    },
  });

  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';

  const checkIn = useWatch({ control, name: 'check_in_date' });
  const checkOut = useWatch({ control, name: 'check_out_date' });
  const dateOrderError = !!(checkIn && checkOut && checkOut <= checkIn);

  const minDate = tripStartDate ? new Date(tripStartDate + 'T00:00:00') : undefined;
  const maxDate = tripEndDate ? new Date(tripEndDate + 'T00:00:00') : undefined;

  // Re-sync trip date defaults when the sheet opens (trip data may load after initial render).
  useEffect(() => {
    if (visible) {
      reset({
        title: '',
        auto_close: false,
        check_in_date: tripStartDate ?? undefined,
        check_out_date: tripEndDate ?? undefined,
      });
      setPriceText('');
    }
  }, [visible, tripStartDate, tripEndDate]);

  const onValid = (data: CreateAccommodationInput) => {
    if (dateOrderError) return;
    Keyboard.dismiss();
    onSubmit(data);
    reset();
    setPriceText('');
  };

  const handleClose = () => {
    reset();
    setPriceText('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-background/80"
          onPress={handleClose}
        />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          {/* Handle bar */}
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">{tCommon('button.add')}</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
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
                      value={value}
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

              {/* Price */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.price')} ({currencySymbol})</Text>
                <Controller
                  control={control}
                  name="price_total"
                  render={({ field: { onChange } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder="0.00"
                      value={priceText}
                      onChangeText={(t) => {
                        const cleaned = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').replace(/(\.\d{2}).+/, '$1');
                        setPriceText(cleaned);
                        const num = parseFloat(cleaned);
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
                      placeholder={t('placeholder.url')}
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

              {/* Check-in date */}
              <Controller
                control={control}
                name="check_in_date"
                render={({ field: { onChange, value } }) => (
                  <DateTimePickerField
                    label={t('field.checkIn')}
                    value={value ?? null}
                    onChange={(v) => onChange(v ?? undefined)}
                    mode="date"
                    minimumDate={minDate}
                    maximumDate={maxDate}
                  />
                )}
              />

              {/* Check-out date */}
              <Controller
                control={control}
                name="check_out_date"
                render={({ field: { onChange, value } }) => (
                  <DateTimePickerField
                    label={t('field.checkOut')}
                    value={value ?? null}
                    onChange={(v) => onChange(v ?? undefined)}
                    mode="date"
                    minimumDate={minDate}
                    maximumDate={maxDate}
                  />
                )}
              />

              {dateOrderError && (
                <Text className="text-danger text-body-small">{t('error.checkOutBeforeCheckIn')}</Text>
              )}

              {/* Notes */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.notes')}</Text>
                <Controller
                  control={control}
                  name="notes"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder={t('placeholder.notes')}
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      multiline
                      numberOfLines={2}
                      maxLength={500}
                      style={{ minHeight: 60, textAlignVertical: 'top' }}
                    />
                  )}
                />
              </View>

              {/* Auto Close */}
              <Controller
                control={control}
                name="auto_close"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row items-center justify-between py-xs">
                    <Text className="text-body text-text-primary">{t('field.autoClose')}</Text>
                    <Switch
                      value={value ?? false}
                      onValueChange={onChange}
                      trackColor={{ false: '#3E3E3E', true: isColorful ? colors.surface : colors.primary }}
                      thumbColor={isColorful ? colors.surfaceElevated : '#FFFFFF'}
                      ios_backgroundColor="#3E3E3E"
                    />
                  </View>
                )}
              />

              {/* Submit */}
              <Pressable
                onPress={handleSubmit(onValid)}
                disabled={isPending || dateOrderError}
                className={`items-center py-sm rounded-md mt-sm ${
                  isPending || dateOrderError ? 'bg-primary/50' : 'bg-primary'
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
