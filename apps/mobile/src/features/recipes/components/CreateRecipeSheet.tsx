import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createRecipeSchema, type CreateRecipeInput } from '@vacationist/types';
import { colors, useResolvedTheme } from '@vacationist/ui';

interface CreateRecipeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateRecipeInput) => void;
  isPending: boolean;
}

export function CreateRecipeSheet({ visible, onClose, onSubmit, isPending }: CreateRecipeSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('recipes');
  const { t: tCommon } = useTranslation('common');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateRecipeInput>({
    resolver: zodResolver(createRecipeSchema),
    defaultValues: { title: '', description: null, servings: 4 },
  });

  const onValid = (data: CreateRecipeInput) => {
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
        <Pressable
          className="absolute inset-0 bg-background/80"
          onPress={handleClose}
        />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">{t('create.title')}</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View className="gap-md">
            <View className="gap-xs">
              <Text className="text-label text-text-muted uppercase">{t('field.titleLabel')} *</Text>
              <Controller
                control={control}
                name="title"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                    placeholderTextColor="#5C5C5C"
                    placeholder="e.g. Pasta Carbonara"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    maxLength={100}
                    autoFocus
                  />
                )}
              />
              {errors.title && (
                <Text className="text-danger text-body-small">{errors.title.message}</Text>
              )}
            </View>

            <View className="gap-xs">
              <Text className="text-label text-text-muted uppercase">{t('field.descriptionLabel')}</Text>
              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                    placeholderTextColor="#5C5C5C"
                    placeholder="Optional notes or instructions"
                    value={value ?? ''}
                    onChangeText={(v) => onChange(v || null)}
                    onBlur={onBlur}
                    maxLength={1000}
                    multiline
                    numberOfLines={3}
                    style={{ textAlignVertical: 'top', minHeight: 80 }}
                  />
                )}
              />
            </View>

            <View className="gap-xs">
              <Text className="text-label text-text-muted uppercase">{t('field.servingsLabel')}</Text>
              <Controller
                control={control}
                name="servings"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row items-center gap-md">
                    <Pressable
                      onPress={() => onChange(Math.max(1, (value ?? 4) - 1))}
                      className="w-[40px] h-[40px] rounded-sm bg-surface border border-border items-center justify-center"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text className="text-text-primary text-heading-m">-</Text>
                    </Pressable>
                    <Text className="text-text-primary text-body font-semibold min-w-[32px] text-center">
                      {value ?? 4}
                    </Text>
                    <Pressable
                      onPress={() => onChange((value ?? 4) + 1)}
                      className="w-[40px] h-[40px] rounded-sm bg-surface border border-border items-center justify-center"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text className="text-text-primary text-heading-m">+</Text>
                    </Pressable>
                  </View>
                )}
              />
              {errors.servings && (
                <Text className="text-danger text-body-small">{errors.servings.message}</Text>
              )}
            </View>

            <Pressable
              onPress={handleSubmit(onValid)}
              disabled={isPending}
              className={`items-center py-sm rounded-md ${isPending ? 'bg-primary/50' : 'bg-primary'}`}
              style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-white text-body font-semibold" style={isColorful ? { color: colors.surface } : undefined}>
                {isPending ? t('create.creating') : t('create.submit')}
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
