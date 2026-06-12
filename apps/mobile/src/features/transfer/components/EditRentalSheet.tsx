import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateTransferRentalSchema, type UpdateTransferRentalInput, type TransferRental, type Currency } from '@vacationist/types';
import { getCurrencySymbol } from '@vacationist/utils';
import { DateTimePickerField } from '../../../components/DateTimePickerField';

interface EditRentalSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateTransferRentalInput) => void;
  isPending: boolean;
  rental: TransferRental;
  currency: string;
  tripStartDate?: string;
  tripEndDate?: string;
}

export function EditRentalSheet({ visible, onClose, onSubmit, isPending, rental, currency, tripStartDate, tripEndDate }: EditRentalSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('transfer');
  const { t: tCommon } = useTranslation('common');
  const [priceText, setPriceText] = useState('');
  const currencySymbol = getCurrencySymbol(currency as Currency);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<UpdateTransferRentalInput>({
    resolver: zodResolver(updateTransferRentalSchema),
  });

  const pickupDate = watch('pickup_date');

  useEffect(() => {
    if (visible) {
      reset({
        title: rental.title,
        company: rental.company ?? undefined,
        pickup_location: rental.pickup_location ?? undefined,
        dropoff_location: rental.dropoff_location ?? undefined,
        pickup_date: rental.pickup_date?.split('T')[0] ?? undefined,
        dropoff_date: rental.dropoff_date?.split('T')[0] ?? undefined,
        booking_reference: rental.booking_reference ?? undefined,
        price_total: rental.price_total ?? undefined,
        external_url: rental.external_url ?? undefined,
        notes: rental.notes ?? undefined,
      });
      setPriceText(rental.price_total != null ? String(rental.price_total) : '');
    }
  }, [visible, rental]);

  const onValid = (data: UpdateTransferRentalInput) => {
    Keyboard.dismiss();
    onSubmit(data);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[90%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">{t('rental.edit.title')}</Text>
              <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-md">
                {/* Title */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('rental.field.title')} *</Text>
                  <Controller
                    control={control}
                    name="title"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('rental.placeholder.title')}
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

                {/* Company */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('rental.field.company')}</Text>
                  <Controller
                    control={control}
                    name="company"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('rental.placeholder.company')}
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
                  <Text className="text-label text-text-muted uppercase">{t('rental.field.pickup')}</Text>
                  <Controller
                    control={control}
                    name="pickup_location"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('rental.placeholder.pickup')}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        maxLength={200}
                      />
                    )}
                  />
                </View>

                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('rental.field.dropoff')}</Text>
                  <Controller
                    control={control}
                    name="dropoff_location"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('rental.placeholder.dropoff')}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        maxLength={200}
                      />
                    )}
                  />
                </View>

                {/* Dates */}
                <View className="flex-row gap-sm">
                  <View className="flex-1 gap-xs">
                    <Text className="text-label text-text-muted uppercase">{t('rental.field.pickupDate')}</Text>
                    <Controller
                      control={control}
                      name="pickup_date"
                      render={({ field: { onChange, value } }) => (
                        <DateTimePickerField
                          mode="date"
                          value={value ?? null}
                          onChange={onChange}
                          placeholder={tCommon('placeholder.selectDate')}
                          minimumDate={tripStartDate ? new Date(tripStartDate + 'T00:00:00') : undefined}
                          maximumDate={tripEndDate ? new Date(tripEndDate + 'T23:59:59') : undefined}
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1 gap-xs">
                    <Text className="text-label text-text-muted uppercase">{t('rental.field.dropoffDate')}</Text>
                    <Controller
                      control={control}
                      name="dropoff_date"
                      render={({ field: { onChange, value } }) => (
                        <DateTimePickerField
                          mode="date"
                          value={value ?? null}
                          onChange={onChange}
                          placeholder={tCommon('placeholder.selectDate')}
                          minimumDate={pickupDate ? new Date(pickupDate + 'T00:00:00') : (tripStartDate ? new Date(tripStartDate + 'T00:00:00') : undefined)}
                          maximumDate={tripEndDate ? new Date(tripEndDate + 'T23:59:59') : undefined}
                        />
                      )}
                    />
                  </View>
                </View>

                {/* Booking Reference */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('rental.field.bookingRef')}</Text>
                  <Controller
                    control={control}
                    name="booking_reference"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('rental.placeholder.bookingRef')}
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
                  <Text className="text-label text-text-muted uppercase">{t('rental.field.price')} ({currencySymbol})</Text>
                  <Controller
                    control={control}
                    name="price_total"
                    render={({ field: { onChange } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('rental.placeholder.price')}
                        value={priceText}
                        onChangeText={(text) => {
                          const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').replace(/(\.\d{2}).+/, '$1');
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
                  <Text className="text-label text-text-muted uppercase">{t('rental.field.url')}</Text>
                  <Controller
                    control={control}
                    name="external_url"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('rental.placeholder.url')}
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
                  <Text className="text-label text-text-muted uppercase">{t('rental.field.notes')}</Text>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('rental.placeholder.notes')}
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
