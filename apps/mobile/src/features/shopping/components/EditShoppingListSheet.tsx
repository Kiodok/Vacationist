import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateShoppingListSchema, type UpdateShoppingListInput } from '@vacationist/types';
import { colors, useResolvedTheme } from '@vacationist/ui';

interface EditShoppingListSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateShoppingListInput) => void;
  isPending: boolean;
  currentTitle: string;
}

export function EditShoppingListSheet({ visible, onClose, onSubmit, isPending, currentTitle }: EditShoppingListSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('shopping');
  const { t: tCommon } = useTranslation('common');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { control, handleSubmit, reset, formState: { errors } } = useForm<UpdateShoppingListInput>({
    resolver: zodResolver(updateShoppingListSchema),
    defaultValues: { title: currentTitle },
  });

  useEffect(() => {
    if (visible) {
      reset({ title: currentTitle });
    }
  }, [visible, currentTitle]);

  const onValid = (data: UpdateShoppingListInput) => {
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
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">Rename List</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
            </Pressable>
          </View>

          <View className="gap-md">
            <View className="gap-xs">
              <Text className="text-label text-text-muted uppercase">Title *</Text>
              <Controller
                control={control}
                name="title"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                    placeholderTextColor="#5C5C5C"
                    placeholder="e.g. Groceries, Beach Day"
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

            <Pressable
              onPress={handleSubmit(onValid)}
              disabled={isPending}
              className={`items-center py-sm rounded-md ${isPending ? 'bg-primary/50' : 'bg-primary'}`}
              style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-white text-body font-semibold" style={isColorful ? { color: colors.surface } : undefined}>
                {isPending ? tCommon('label.saving') : tCommon('button.save')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
