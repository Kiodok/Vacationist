import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTransferFlightSchema, type CreateTransferFlightInput, TRANSFER_DIRECTION } from '@vacationist/types';
import { DateTimePickerField } from '../../../components/DateTimePickerField';

interface CreateFlightSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTransferFlightInput) => void;
  isPending: boolean;
  currency: string;
}

export function CreateFlightSheet({ visible, onClose, onSubmit, isPending, currency }: CreateFlightSheetProps) {
  const [priceText, setPriceText] = useState('');
  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreateTransferFlightInput>({
    resolver: zodResolver(createTransferFlightSchema),
    defaultValues: { title: '', direction: 'outbound' },
  });

  const direction = watch('direction');

  const onValid = (data: CreateTransferFlightInput) => {
    Keyboard.dismiss();
    onSubmit(data);
    reset({ title: '', direction: 'outbound' });
    setPriceText('');
  };

  const handleClose = () => {
    reset({ title: '', direction: 'outbound' });
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
              <Text className="text-heading-m text-text-primary">New Flight</Text>
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
                        placeholder="e.g. Swiss Air LX1234"
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

                {/* Direction */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Direction *</Text>
                  <View className="flex-row gap-sm">
                    {TRANSFER_DIRECTION.map((dir) => (
                      <Pressable
                        key={dir}
                        onPress={() => setValue('direction', dir)}
                        className={`flex-1 items-center py-sm rounded-sm border ${
                          direction === dir ? 'bg-primary border-primary' : 'bg-surface border-border'
                        }`}
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <Text className={`text-body font-medium ${direction === dir ? 'text-white' : 'text-text-secondary'}`}>
                          {dir === 'outbound' ? 'Outbound' : 'Return'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Airline */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Airline</Text>
                  <Controller
                    control={control}
                    name="airline"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="e.g. Swiss International Air Lines"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        maxLength={100}
                      />
                    )}
                  />
                </View>

                {/* Airports */}
                <View className="flex-row gap-sm">
                  <View className="flex-1 gap-xs">
                    <Text className="text-label text-text-muted uppercase">From</Text>
                    <Controller
                      control={control}
                      name="departure_airport"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                          placeholderTextColor="#5C5C5C"
                          placeholder="ZRH"
                          value={value ?? ''}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          autoCapitalize="characters"
                          maxLength={100}
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1 gap-xs">
                    <Text className="text-label text-text-muted uppercase">To</Text>
                    <Controller
                      control={control}
                      name="arrival_airport"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                          placeholderTextColor="#5C5C5C"
                          placeholder="BCN"
                          value={value ?? ''}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          autoCapitalize="characters"
                          maxLength={100}
                        />
                      )}
                    />
                  </View>
                </View>

                {/* Departure date + time */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Departure</Text>
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
                            placeholder="Date"
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
                            placeholder="Time"
                          />
                        )}
                      />
                    </View>
                  </View>
                </View>

                {/* Arrival date + time */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Arrival</Text>
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
                            placeholder="Date"
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
                            placeholder="Time"
                          />
                        )}
                      />
                    </View>
                  </View>
                </View>

                {/* Price per person */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Price / Person ({currencySymbol})</Text>
                  <Controller
                    control={control}
                    name="price_per_person"
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
                        placeholder="Luggage allowance, seat class, etc."
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
                    {isPending ? 'Adding...' : 'Add Flight'}
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
