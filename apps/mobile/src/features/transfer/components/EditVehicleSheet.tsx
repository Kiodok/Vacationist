import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateTransferVehicleSchema, type UpdateTransferVehicleInput, type TransferVehicle } from '@vacationist/types';

interface EditVehicleSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateTransferVehicleInput) => void;
  isPending: boolean;
  vehicle: TransferVehicle;
}

export function EditVehicleSheet({ visible, onClose, onSubmit, isPending, vehicle }: EditVehicleSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('transfer');
  const { t: tCommon } = useTranslation('common');
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<UpdateTransferVehicleInput>({
    resolver: zodResolver(updateTransferVehicleSchema),
  });

  const direction = watch('direction');

  useEffect(() => {
    if (visible) {
      reset({
        title: vehicle.title,
        direction: vehicle.direction,
        notes: vehicle.notes ?? undefined,
      });
    }
  }, [visible, vehicle]);

  const onValid = (data: UpdateTransferVehicleInput) => {
    Keyboard.dismiss();
    onSubmit(data);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">{t('vehicle.edit.title')}</Text>
              <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-md">
                {/* Title */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('vehicle.field.title')} *</Text>
                  <Controller
                    control={control}
                    name="title"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('vehicle.placeholder.title')}
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
                  <Text className="text-label text-text-muted uppercase">{t('vehicle.field.direction')} *</Text>
                  <View className="flex-row gap-sm">
                    {(['outbound-return', 'outbound', 'return'] as const).map((dir) => (
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
                </View>

                {/* Notes */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('vehicle.field.notes')}</Text>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('vehicle.placeholder.notes')}
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
