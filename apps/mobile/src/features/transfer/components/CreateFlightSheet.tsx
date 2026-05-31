import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard, Switch } from 'react-native';
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

function parseMinDate(isoLocal: string | null | undefined): Date | undefined {
  if (!isoLocal) return undefined;
  const [datePart, timePart] = isoLocal.split('T');
  if (!datePart) return undefined;
  const [y, m, d] = datePart.split('-').map(Number);
  const [h = 0, min = 0] = (timePart ?? '').split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

const DIRECTION_ORDER = ['outbound-return', 'outbound', 'return'] as const;

export function CreateFlightSheet({ visible, onClose, onSubmit, isPending, currency }: CreateFlightSheetProps) {
  const { t } = useTranslation('transfer');
  const { t: tCommon } = useTranslation('common');
  const [priceText, setPriceText] = useState('');
  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreateTransferFlightInput>({
    resolver: zodResolver(createTransferFlightSchema),
    defaultValues: { title: '', direction: 'outbound-return', auto_close: false },
  });

  const direction = watch('direction');
  const departureTime = watch('departure_time');
  const arrivalTime = watch('arrival_time');
  const returnDepartureTime = watch('return_departure_time');

  const onValid = (data: CreateTransferFlightInput) => {
    Keyboard.dismiss();
    onSubmit(data);
    reset({ title: '', direction: 'outbound-return', auto_close: false });
    setPriceText('');
  };

  const handleClose = () => {
    reset({ title: '', direction: 'outbound-return', auto_close: false });
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
              <Text className="text-heading-m text-text-primary">{t('flight.create.title')}</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-md">
                {/* Title */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('flight.field.title')} *</Text>
                  <Controller
                    control={control}
                    name="title"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('flight.placeholder.title')}
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
                  <Text className="text-label text-text-muted uppercase">{t('flight.field.direction')} *</Text>
                  <View className="flex-row gap-sm">
                    {DIRECTION_ORDER.map((dir) => (
                      <Pressable
                        key={dir}
                        onPress={() => setValue('direction', dir)}
                        className={`flex-1 items-center py-sm rounded-sm border ${
                          direction === dir ? 'bg-primary border-primary' : 'bg-surface border-border'
                        }`}
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <Text className={`text-body-small font-medium ${direction === dir ? 'text-white' : 'text-text-secondary'}`}>
                          {dir === 'outbound-return' ? t('direction.both') : dir === 'outbound' ? t('direction.outbound') : t('direction.return')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {direction === 'outbound-return' && (
                    <Text className="text-body-small text-text-secondary">
                      {t('flight.info.combinedPrice')}
                    </Text>
                  )}
                </View>

                {/* Airline */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('flight.field.airline')}</Text>
                  <Controller
                    control={control}
                    name="airline"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('flight.placeholder.airline')}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        maxLength={100}
                      />
                    )}
                  />
                </View>

                {/* ── Outbound leg ── */}
                {direction === 'outbound-return' && (
                  <Text className="text-label text-primary uppercase font-semibold">{t('flight.section.outboundLeg')}</Text>
                )}

                {/* Airports */}
                <View className="flex-row gap-sm">
                  <View className="flex-1 gap-xs">
                    <Text className="text-label text-text-muted uppercase">{t('flight.field.departure')}</Text>
                    <Controller
                      control={control}
                      name="departure_airport"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                          placeholderTextColor="#5C5C5C"
                          placeholder={t('flight.placeholder.departure')}
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
                    <Text className="text-label text-text-muted uppercase">{t('flight.field.arrival')}</Text>
                    <Controller
                      control={control}
                      name="arrival_airport"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                          placeholderTextColor="#5C5C5C"
                          placeholder={t('flight.placeholder.arrival')}
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
                  <Text className="text-label text-text-muted uppercase">{t('flight.field.departureTime')}</Text>
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
                              if (date && !arrivalTime) {
                                setValue('arrival_time', `${date}T00:00`);
                              }
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
                  <Text className="text-label text-text-muted uppercase">{t('flight.field.arrivalTime')}</Text>
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
                            minimumDate={parseMinDate(departureTime)}
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
                  {errors.arrival_time && (
                    <Text className="text-danger text-body-small">{errors.arrival_time.message}</Text>
                  )}
                </View>

                {/* ── Return leg (outbound-return only) ── */}
                {direction === 'outbound-return' && (
                  <>
                    <Text className="text-label text-warning uppercase font-semibold">{t('flight.section.returnLeg')}</Text>

                    {/* Return airports */}
                    <View className="flex-row gap-sm">
                      <View className="flex-1 gap-xs">
                        <Text className="text-label text-text-muted uppercase">{t('flight.field.departure')}</Text>
                        <Controller
                          control={control}
                          name="return_departure_airport"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                              className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                              placeholderTextColor="#5C5C5C"
                              placeholder={t('flight.placeholder.arrival')}
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
                        <Text className="text-label text-text-muted uppercase">{t('flight.field.arrival')}</Text>
                        <Controller
                          control={control}
                          name="return_arrival_airport"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <TextInput
                              className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                              placeholderTextColor="#5C5C5C"
                              placeholder={t('flight.placeholder.departure')}
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

                    {/* Return departure */}
                    <View className="gap-xs">
                      <Text className="text-label text-text-muted uppercase">{t('flight.field.returnDeparture')}</Text>
                      <View className="flex-row gap-sm">
                        <View className="flex-1">
                          <Controller
                            control={control}
                            name="return_departure_time"
                            render={({ field: { onChange, value } }) => (
                              <DateTimePickerField
                                mode="date"
                                value={value ? value.split('T')[0] : null}
                                onChange={(date) => {
                                  const time = value?.split('T')[1] ?? null;
                                  onChange(date && time ? `${date}T${time}` : date ? `${date}T00:00` : null);
                                  if (date && !watch('return_arrival_time')) {
                                    setValue('return_arrival_time', `${date}T00:00`);
                                  }
                                }}
                                placeholder="Date"
                                minimumDate={parseMinDate(arrivalTime)}
                              />
                            )}
                          />
                        </View>
                        <View className="flex-1">
                          <Controller
                            control={control}
                            name="return_departure_time"
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
                      {errors.return_departure_time && (
                        <Text className="text-danger text-body-small">{errors.return_departure_time.message}</Text>
                      )}
                    </View>

                    {/* Return arrival */}
                    <View className="gap-xs">
                      <Text className="text-label text-text-muted uppercase">{t('flight.field.returnArrival')}</Text>
                      <View className="flex-row gap-sm">
                        <View className="flex-1">
                          <Controller
                            control={control}
                            name="return_arrival_time"
                            render={({ field: { onChange, value } }) => (
                              <DateTimePickerField
                                mode="date"
                                value={value ? value.split('T')[0] : null}
                                onChange={(date) => {
                                  const time = value?.split('T')[1] ?? null;
                                  onChange(date && time ? `${date}T${time}` : date ? `${date}T00:00` : null);
                                }}
                                placeholder="Date"
                                minimumDate={parseMinDate(returnDepartureTime)}
                              />
                            )}
                          />
                        </View>
                        <View className="flex-1">
                          <Controller
                            control={control}
                            name="return_arrival_time"
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
                      {errors.return_arrival_time && (
                        <Text className="text-danger text-body-small">{errors.return_arrival_time.message}</Text>
                      )}
                    </View>
                  </>
                )}

                {/* Price per person */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">
                    {direction === 'outbound-return'
                      ? `${t('flight.field.combinedPrice')} (${currencySymbol})`
                      : `${t('flight.field.price')} (${currencySymbol})`}
                  </Text>
                  <Controller
                    control={control}
                    name="price_per_person"
                    render={({ field: { onChange } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('flight.placeholder.price')}
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
                  <Text className="text-label text-text-muted uppercase">{t('flight.field.url')}</Text>
                  <Controller
                    control={control}
                    name="external_url"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('flight.placeholder.url')}
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
                  <Text className="text-label text-text-muted uppercase">{t('flight.field.notes')}</Text>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('flight.placeholder.notes')}
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
                      <Text className="text-body text-text-primary">{t('flight.field.autoClose')}</Text>
                      <Switch
                        value={value ?? false}
                        onValueChange={onChange}
                        trackColor={{ false: '#3E3E3E', true: '#6C63FF' }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#3E3E3E"
                      />
                    </View>
                  )}
                />

                <Pressable
                  onPress={handleSubmit(onValid)}
                  disabled={isPending}
                  className={`items-center py-sm rounded-md mt-sm ${isPending ? 'bg-primary/50' : 'bg-primary'}`}
                  style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-white text-body font-semibold">
                    {isPending ? t('flight.create.adding') : t('flight.create.submit')}
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
