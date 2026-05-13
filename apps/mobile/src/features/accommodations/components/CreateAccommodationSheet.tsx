import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, Keyboard } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAccommodationSchema, type CreateAccommodationInput } from '@vacationist/types';

interface CreateAccommodationSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAccommodationInput) => void;
  isPending: boolean;
  currency: string;
}

export function CreateAccommodationSheet({ visible, onClose, onSubmit, isPending, currency }: CreateAccommodationSheetProps) {
  const [priceText, setPriceText] = useState('');
  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateAccommodationInput>({
    resolver: zodResolver(createAccommodationSchema),
    defaultValues: { title: '' },
  });

  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';

  const onValid = (data: CreateAccommodationInput) => {
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
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-background/80"
          onPress={handleClose}
        />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl max-h-[85%]">
          {/* Handle bar */}
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">New Accommodation</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">Cancel</Text>
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
                      placeholder="e.g. Airbnb near city center"
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
                <Text className="text-label text-text-muted uppercase">Description</Text>
                <Controller
                  control={control}
                  name="description"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder="Details about the place"
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
                      placeholder="https://booking.com/..."
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
                      placeholder="Check-in times, parking, etc."
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
                  {isPending ? 'Adding...' : 'Add Accommodation'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
