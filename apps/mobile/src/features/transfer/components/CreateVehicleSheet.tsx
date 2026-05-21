import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTransferVehicleSchema, type CreateTransferVehicleInput, TRANSFER_DIRECTION } from '@vacationist/types';

interface CreateVehicleSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTransferVehicleInput) => void;
  isPending: boolean;
}

export function CreateVehicleSheet({ visible, onClose, onSubmit, isPending }: CreateVehicleSheetProps) {
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreateTransferVehicleInput>({
    resolver: zodResolver(createTransferVehicleSchema),
    defaultValues: { title: '', direction: 'outbound' },
  });

  const direction = watch('direction');

  const onValid = (data: CreateTransferVehicleInput) => {
    Keyboard.dismiss();
    onSubmit(data);
    reset({ title: '', direction: 'outbound' });
  };

  const handleClose = () => {
    reset({ title: '', direction: 'outbound' });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl max-h-[85%]">
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">New Vehicle</Text>
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
                        placeholder="e.g. Gary's car"
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
                        placeholder="Meeting point, departure time, etc."
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
                    {isPending ? 'Adding...' : 'Add Vehicle'}
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
