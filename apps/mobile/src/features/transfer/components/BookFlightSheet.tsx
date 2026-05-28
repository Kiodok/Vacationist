import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { bookTransferFlightSchema, type BookTransferFlightInput } from '@vacationist/types';

interface BookFlightSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: BookTransferFlightInput) => void;
  isPending: boolean;
}

export function BookFlightSheet({ visible, onClose, onSubmit, isPending }: BookFlightSheetProps) {
  const { t } = useTranslation('transfer');
  const { t: tCommon } = useTranslation("common");
  const { control, handleSubmit, reset, formState: { errors } } = useForm<BookTransferFlightInput>({
    resolver: zodResolver(bookTransferFlightSchema),
    defaultValues: { flight_number: '', booking_reference: '' },
  });

  const onValid = (data: BookTransferFlightInput) => {
    Keyboard.dismiss();
    onSubmit({
      flight_number: data.flight_number || undefined,
      booking_reference: data.booking_reference || undefined,
    });
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl">
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">{t('action.book')}</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-md">
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('flight.field.flightNumber')}</Text>
                  <Controller
                    control={control}
                    name="flight_number"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('flight.placeholder.flightNumber')}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        autoCapitalize="characters"
                        maxLength={20}
                      />
                    )}
                  />
                  {errors.flight_number && (
                    <Text className="text-danger text-body-small">{errors.flight_number.message}</Text>
                  )}
                </View>

                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('flight.field.bookingRef')}</Text>
                  <Controller
                    control={control}
                    name="booking_reference"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('flight.placeholder.bookingRef')}
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        autoCapitalize="characters"
                        maxLength={50}
                      />
                    )}
                  />
                  {errors.booking_reference && (
                    <Text className="text-danger text-body-small">{errors.booking_reference.message}</Text>
                  )}
                </View>

                <Pressable
                  onPress={handleSubmit(onValid)}
                  disabled={isPending}
                  className={`items-center py-sm rounded-md mt-sm ${isPending ? 'bg-primary/50' : 'bg-primary'}`}
                  style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-white text-body font-semibold">
                    {isPending ? tCommon('label.saving') : t('action.book')}
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
