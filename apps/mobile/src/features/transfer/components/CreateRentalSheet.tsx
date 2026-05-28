import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTransferRentalSchema, type CreateTransferRentalInput } from '@vacationist/types';
import { DateTimePickerField } from '../../../components/DateTimePickerField';

interface CreateRentalSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTransferRentalInput) => void;
  isPending: boolean;
  currency: string;
}

export function CreateRentalSheet({ visible, onClose, onSubmit, isPending, currency }: CreateRentalSheetProps) {
  const { t } = useTranslation('transfer');
  const { t: tCommon } = useTranslation('common');
  const [priceText, setPriceText] = useState('');
  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateTransferRentalInput>({
    resolver: zodResolver(createTransferRentalSchema),
    defaultValues: { title: '' },
  });

  const onValid = (data: CreateTransferRentalInput) => {
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
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl max-h-[90%]">
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">New Rental Car</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-md">
                {/* Title */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Title *</Text>
                  <Controller
                    control={control}
                    name="title"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="e.g. Hertz VW Golf"
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

                {/* Company */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Company</Text>
                  <Controller
                    control={control}
                    name="company"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="e.g. Hertz, Europcar, Sixt"
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
                  <Text className="text-label text-text-muted uppercase">Pickup Location</Text>
                  <Controller
                    control={control}
                    name="pickup_location"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="e.g. Barcelona Airport T1"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        maxLength={200}
                      />
                    )}
                  />
                </View>

                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Dropoff Location</Text>
                  <Controller
                    control={control}
                    name="dropoff_location"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="Same as pickup or different location"
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
                    <Text className="text-label text-text-muted uppercase">Pickup Date</Text>
                    <Controller
                      control={control}
                      name="pickup_date"
                      render={({ field: { onChange, value } }) => (
                        <DateTimePickerField
                          mode="date"
                          value={value ?? null}
                          onChange={onChange}
                          placeholder="Select date"
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1 gap-xs">
                    <Text className="text-label text-text-muted uppercase">Dropoff Date</Text>
                    <Controller
                      control={control}
                      name="dropoff_date"
                      render={({ field: { onChange, value } }) => (
                        <DateTimePickerField
                          mode="date"
                          value={value ?? null}
                          onChange={onChange}
                          placeholder="Select date"
                        />
                      )}
                    />
                  </View>
                </View>

                {/* Booking Reference */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Booking Reference</Text>
                  <Controller
                    control={control}
                    name="booking_reference"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="e.g. HZ-ABC123456"
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
                  <Text className="text-label text-text-muted uppercase">Total Price ({currencySymbol})</Text>
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
                  <Text className="text-label text-text-muted uppercase">Link</Text>
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

                {/* Notes */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Notes</Text>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="Insurance, GPS, additional drivers, etc."
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
                    {isPending ? 'Adding...' : 'Add Rental Car'}
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
