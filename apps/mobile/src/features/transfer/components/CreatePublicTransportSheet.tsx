import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTransferPublicTransportSchema, type CreateTransferPublicTransportInput, type Currency } from '@vacationist/types';
import { getCurrencySymbol, sanitizeDecimalInput } from '@vacationist/utils';
import { DateTimePickerField } from '../../../components/DateTimePickerField';
import { colors, useResolvedTheme } from '@vacationist/ui';

interface CreatePublicTransportSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTransferPublicTransportInput) => void;
  isPending: boolean;
  currency: string;
  tripStartDate?: string;
  tripEndDate?: string;
}

function parseMinDate(isoLocal: string | null | undefined): Date | undefined {
  if (!isoLocal) return undefined;
  const [datePart, timePart] = isoLocal.split('T');
  if (!datePart) return undefined;
  const [y, m, d] = datePart.split('-').map(Number);
  const [h = 0, min = 0] = (timePart ?? '').split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

export function CreatePublicTransportSheet({ visible, onClose, onSubmit, isPending, currency, tripStartDate, tripEndDate }: CreatePublicTransportSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('transfer');
  const { t: tCommon } = useTranslation('common');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const [priceText, setPriceText] = useState('');
  const currencySymbol = getCurrencySymbol(currency as Currency);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<CreateTransferPublicTransportInput>({
    resolver: zodResolver(createTransferPublicTransportSchema),
    defaultValues: { title: '' },
  });

  const departureTime = watch('departure_time');

  const onValid = (data: CreateTransferPublicTransportInput) => {
    Keyboard.dismiss();
    onSubmit(data);
    reset({ title: '' });
    setPriceText('');
  };

  const handleClose = () => {
    reset({ title: '' });
    setPriceText('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[90%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">{t('publicTransport.create.title')}</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-md">
                {/* Title */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('publicTransport.field.title')} *</Text>
                  <Controller
                    control={control}
                    name="title"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('publicTransport.placeholder.title')}
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

                {/* Company / operator */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('publicTransport.field.company')}</Text>
                  <Controller
                    control={control}
                    name="company"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('publicTransport.placeholder.company')}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        maxLength={100}
                      />
                    )}
                  />
                </View>

                {/* Locations */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('publicTransport.field.departureLocation')}</Text>
                  <Controller
                    control={control}
                    name="departure_location"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('publicTransport.placeholder.departureLocation')}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        maxLength={200}
                      />
                    )}
                  />
                </View>

                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('publicTransport.field.arrivalLocation')}</Text>
                  <Controller
                    control={control}
                    name="arrival_location"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('publicTransport.placeholder.arrivalLocation')}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        maxLength={200}
                      />
                    )}
                  />
                </View>

                {/* Departure date + time */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('publicTransport.field.departureTime')}</Text>
                  <View className="flex-row gap-sm">
                    <View className="flex-1">
                      <Controller
                        control={control}
                        name="departure_time"
                        render={({ field: { onChange, value } }) => (
                          <DateTimePickerField
                            mode="date"
                            value={value ? value.split('T')[0] : null}
                            onChange={(date) => {
                              const time = value?.split('T')[1] ?? null;
                              onChange(date && time ? `${date}T${time}` : date ? `${date}T00:00` : null);
                            }}
                            placeholder={tCommon('placeholder.date')}
                            minimumDate={tripStartDate ? new Date(tripStartDate + 'T00:00:00') : undefined}
                            maximumDate={tripEndDate ? new Date(tripEndDate + 'T23:59:59') : undefined}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1">
                      <Controller
                        control={control}
                        name="departure_time"
                        render={({ field: { onChange, value } }) => (
                          <DateTimePickerField
                            mode="time"
                            value={value ? value.split('T')[1] : null}
                            onChange={(time) => {
                              const date = value?.split('T')[0] ?? null;
                              onChange(date && time ? `${date}T${time}` : null);
                            }}
                            placeholder={tCommon('placeholder.time')}
                          />
                        )}
                      />
                    </View>
                  </View>
                </View>

                {/* Arrival date + time */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('publicTransport.field.arrivalTime')}</Text>
                  <View className="flex-row gap-sm">
                    <View className="flex-1">
                      <Controller
                        control={control}
                        name="arrival_time"
                        render={({ field: { onChange, value } }) => (
                          <DateTimePickerField
                            mode="date"
                            value={value ? value.split('T')[0] : null}
                            onChange={(date) => {
                              const time = value?.split('T')[1] ?? null;
                              onChange(date && time ? `${date}T${time}` : date ? `${date}T00:00` : null);
                            }}
                            placeholder={tCommon('placeholder.date')}
                            minimumDate={parseMinDate(departureTime)}
                            maximumDate={tripEndDate ? new Date(tripEndDate + 'T23:59:59') : undefined}
                          />
                        )}
                      />
                    </View>
                    <View className="flex-1">
                      <Controller
                        control={control}
                        name="arrival_time"
                        render={({ field: { onChange, value } }) => (
                          <DateTimePickerField
                            mode="time"
                            value={value ? value.split('T')[1] : null}
                            onChange={(time) => {
                              const date = value?.split('T')[0] ?? null;
                              onChange(date && time ? `${date}T${time}` : null);
                            }}
                            placeholder={tCommon('placeholder.time')}
                          />
                        )}
                      />
                    </View>
                  </View>
                </View>

                {/* Booking Reference */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('publicTransport.field.bookingRef')}</Text>
                  <Controller
                    control={control}
                    name="booking_reference"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('publicTransport.placeholder.bookingRef')}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        autoCapitalize="characters"
                        maxLength={50}
                      />
                    )}
                  />
                </View>

                {/* Price */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('publicTransport.field.price')} ({currencySymbol})</Text>
                  <Controller
                    control={control}
                    name="price_total"
                    render={({ field: { onChange } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('publicTransport.placeholder.price')}
                        value={priceText}
                        onChangeText={(text) => {
                          const cleaned = sanitizeDecimalInput(text);
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
                  <Text className="text-label text-text-muted uppercase">{t('publicTransport.field.url')}</Text>
                  <Controller
                    control={control}
                    name="external_url"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('publicTransport.placeholder.url')}
                        value={value ?? ''}
                        onChangeText={(text) => onChange(text || null)}
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

                {/* Notes */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('publicTransport.field.notes')}</Text>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('publicTransport.placeholder.notes')}
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

                <Pressable
                  onPress={handleSubmit(onValid)}
                  disabled={isPending}
                  className={`items-center py-sm rounded-md mt-sm ${isPending ? 'bg-primary/50' : 'bg-primary'}`}
                  style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-white text-body font-semibold" style={isColorful ? { color: colors.surface } : undefined}>
                    {isPending ? t('publicTransport.create.adding') : t('publicTransport.create.submit')}
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
