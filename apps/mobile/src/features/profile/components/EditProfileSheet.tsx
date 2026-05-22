import { useEffect } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, type UpdateProfileInput, SUPPORTED_TIMEZONES } from '@vacationist/types';
import type { User } from '@vacationist/types';

interface EditProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateProfileInput) => void;
  isPending: boolean;
  user: User;
}

export function EditProfileSheet({ visible, onClose, onSubmit, isPending, user }: EditProfileSheetProps) {
  const { control, handleSubmit, reset, formState: { errors } } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
  });

  useEffect(() => {
    if (visible) {
      reset({ name: user.name, locale: user.locale, timezone: user.timezone as typeof SUPPORTED_TIMEZONES[number] });
    }
  }, [visible, user]);

  const onValid = (data: UpdateProfileInput) => {
    Keyboard.dismiss();
    onSubmit(data);
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

            <View className="flex-row items-center justify-between mb-lg">
              <Text className="text-heading-m text-text-primary font-semibold">Edit Profile</Text>
              <Pressable onPress={handleClose} hitSlop={12}>
                <Text className="text-body text-text-secondary">Cancel</Text>
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View className="gap-md">
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Display Name</Text>
                  <Controller
                    control={control}
                    name="name"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md min-h-[44px] text-body text-text-primary"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="Your name"
                        placeholderTextColor="#5C5C5C"
                        autoCapitalize="words"
                      />
                    )}
                  />
                  {errors.name && (
                    <Text className="text-body-small text-danger">{errors.name.message}</Text>
                  )}
                </View>

                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Locale</Text>
                  <Controller
                    control={control}
                    name="locale"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md min-h-[44px] text-body text-text-primary"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="e.g. de-DE"
                        placeholderTextColor="#5C5C5C"
                        autoCapitalize="none"
                      />
                    )}
                  />
                </View>

                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Timezone</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="flex-row"
                    contentContainerStyle={{ gap: 8 }}
                  >
                    <Controller
                      control={control}
                      name="timezone"
                      render={({ field: { onChange, value } }) => (
                        <>
                          {SUPPORTED_TIMEZONES.map((tz) => (
                            <Pressable
                              key={tz}
                              onPress={() => onChange(tz)}
                              className={`px-sm py-xs rounded-sm border ${
                                value === tz
                                  ? 'bg-primary/20 border-primary'
                                  : 'bg-surface border-border'
                              }`}
                            >
                              <Text
                                className={`text-body-small ${
                                  value === tz ? 'text-primary' : 'text-text-secondary'
                                }`}
                              >
                                {tz.replace('Europe/', '')}
                              </Text>
                            </Pressable>
                          ))}
                        </>
                      )}
                    />
                  </ScrollView>
                </View>
              </View>
            </ScrollView>

            <Pressable
              onPress={handleSubmit(onValid)}
              disabled={isPending}
              className={`mt-lg min-h-[48px] rounded-sm items-center justify-center ${
                isPending ? 'bg-primary/50' : 'bg-primary'
              }`}
            >
              <Text className="text-body text-white font-semibold">
                {isPending ? 'Saving…' : 'Save Changes'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
