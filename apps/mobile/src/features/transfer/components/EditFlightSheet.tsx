import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateTransferFlightSchema, type UpdateTransferFlightInput, type TransferFlight, TRANSFER_DIRECTION } from '@vacationist/types';
import { DateTimePickerField } from '../../../components/DateTimePickerField';

interface EditFlightSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateTransferFlightInput) => void;
  isPending: boolean;
  flight: TransferFlight;
  currency: string;
  tripStartDate?: string;
  tripEndDate?: string;
}

/** Convert a DB TIMESTAMPTZ string to the local YYYY-MM-DDTHH:MM form the form expects. */
function normalizeFlightTime(isoStr: string | null | undefined): string | undefined {
  if (!isoStr) return undefined;
  const normalized = isoStr.replace(' ', 'T');
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : undefined;
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

export function EditFlightSheet({ visible, onClose, onSubmit, isPending, flight, currency, tripStartDate, tripEndDate }: EditFlightSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('transfer');
  const { t: tCommon } = useTranslation('common');
  const [priceText, setPriceText] = useState('');
  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<UpdateTransferFlightInput>({
    resolver: zodResolver(updateTransferFlightSchema),
  });

  const direction = watch('direction');
  const departureTime = watch('departure_time') as string | null | undefined;
  const arrivalTime = watch('arrival_time') as string | null | undefined;
  const returnDepartureTime = watch('return_departure_time') as string | null | undefined;

  useEffect(() => {
    if (visible) {
      reset({
        title: flight.title,
        direction: flight.direction,
        airline: flight.airline ?? undefined,
        departure_airport: flight.departure_airport ?? undefined,
        arrival_airport: flight.arrival_airport ?? undefined,
        departure_time: normalizeFlightTime(flight.departure_time),
        arrival_time: normalizeFlightTime(flight.arrival_time),
        return_departure_airport: flight.return_departure_airport ?? undefined,
        return_arrival_airport: flight.return_arrival_airport ?? undefined,
        return_departure_time: normalizeFlightTime(flight.return_departure_time),
        return_arrival_time: normalizeFlightTime(flight.return_arrival_time),
        price_per_person: flight.price_per_person ?? undefined,
        external_url: flight.external_url ?? undefined,
        notes: flight.notes ?? undefined,
      });
      setPriceText(flight.price_per_person != null ? String(flight.price_per_person) : '');
    }
  }, [visible, flight]);

  const onValid = (data: UpdateTransferFlightInput) => {
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
              <Text className="text-heading-m text-text-primary">{t('flight.edit.title')}</Text>
              <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
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

                {/* Direction */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('flight.field.direction')} *</Text>
                  <View className="flex-row gap-sm">
                    {DIRECTION_ORDER.map((dir) => (
                      <Pressable
                        key={dir}
                        onPress={() => setValue('direction', dir)}
                        className={`flex-1 items-center justify-center py-sm rounded-sm border min-h-[44px] ${
                          direction === dir ? 'bg-primary border-primary' : 'bg-surface border-border'
                        }`}
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <Text className={`text-body-small font-medium text-center ${direction === dir ? 'text-white' : 'text-text-secondary'}`}>
                          {dir === 'outbound-return' ? t('direction.both') : dir === 'outbound' ? t('direction.outbound') : t('direction.return')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
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

                {/* Departure */}
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
                            value={value ? (value as string).split('T')[0] : null}
                            onChange={(date) => {
                              const time = (value as string | undefined)?.split('T')[1] ?? null;
                              onChange(date && time ? `${date}T${time}` : date ? `${date}T00:00` : null);
                              if (date && !arrivalTime) {
                                setValue('arrival_time', `${date}T00:00`);
                              }
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
                            value={value ? (value as string).split('T')[1] : null}
                            onChange={(time) => {
                              const date = (value as string | undefined)?.split('T')[0] ?? null;
                              onChange(date && time ? `${date}T${time}` : null);
                            }}
                            placeholder={tCommon('placeholder.time')}
                          />
                        )}
                      />
                    </View>
                  </View>
                </View>

                {/* Arrival */}
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
                            value={value ? (value as string).split('T')[0] : null}
                            onChange={(date) => {
                              const time = (value as string | undefined)?.split('T')[1] ?? null;
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
                            value={value ? (value as string).split('T')[1] : null}
                            onChange={(time) => {
                              const date = (value as string | undefined)?.split('T')[0] ?? null;
                              onChange(date && time ? `${date}T${time}` : null);
                            }}
                            placeholder={tCommon('placeholder.time')}
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
                                value={value ? (value as string).split('T')[0] : null}
                                onChange={(date) => {
                                  const time = (value as string | undefined)?.split('T')[1] ?? null;
                                  onChange(date && time ? `${date}T${time}` : date ? `${date}T00:00` : null);
                                  if (date && !watch('return_arrival_time')) {
                                    setValue('return_arrival_time', `${date}T00:00`);
                                  }
                                }}
                                placeholder={tCommon('placeholder.date')}
                                minimumDate={parseMinDate(arrivalTime)}
                                maximumDate={tripEndDate ? new Date(tripEndDate + 'T23:59:59') : undefined}
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
                                value={value ? (value as string).split('T')[1] : null}
                                onChange={(time) => {
                                  const date = (value as string | undefined)?.split('T')[0] ?? null;
                                  onChange(date && time ? `${date}T${time}` : null);
                                }}
                                placeholder={tCommon('placeholder.time')}
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
                                value={value ? (value as string).split('T')[0] : null}
                                onChange={(date) => {
                                  const time = (value as string | undefined)?.split('T')[1] ?? null;
                                  onChange(date && time ? `${date}T${time}` : date ? `${date}T00:00` : null);
                                }}
                                placeholder={tCommon('placeholder.date')}
                                minimumDate={parseMinDate(returnDepartureTime)}
                                maximumDate={tripEndDate ? new Date(tripEndDate + 'T23:59:59') : undefined}
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
                                value={value ? (value as string).split('T')[1] : null}
                                onChange={(time) => {
                                  const date = (value as string | undefined)?.split('T')[0] ?? null;
                                  onChange(date && time ? `${date}T${time}` : null);
                                }}
                                placeholder={tCommon('placeholder.time')}
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
