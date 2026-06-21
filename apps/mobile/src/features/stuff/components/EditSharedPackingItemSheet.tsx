import { useEffect } from 'react';
import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, ScrollView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { updateSharedPackingItemSchema, type UpdateSharedPackingItemInput, type SharedPackingItem } from '@vacationist/types';
import { colors, useResolvedTheme } from '@vacationist/ui';

interface EditSharedPackingItemSheetProps {
  visible: boolean;
  item: SharedPackingItem | null;
  onClose: () => void;
  onSubmit: (itemId: string, input: UpdateSharedPackingItemInput) => void;
  isPending: boolean;
}

export function EditSharedPackingItemSheet({ visible, item, onClose, onSubmit, isPending }: EditSharedPackingItemSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';

  const { control, handleSubmit, reset, formState: { errors } } = useForm<UpdateSharedPackingItemInput>({
    resolver: zodResolver(updateSharedPackingItemSchema),
    defaultValues: { title: item?.title ?? '', notes: item?.notes ?? null },
  });

  useEffect(() => {
    if (visible && item) {
      reset({ title: item.title, notes: item.notes ?? null });
    }
  }, [visible, item?.id]);

  const onValid = (data: UpdateSharedPackingItemInput) => {
    if (!item) return;
    Keyboard.dismiss();
    onSubmit(item.id, data);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>
            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">{t('action.edit')}</Text>
              <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-md">
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('field.title')} *</Text>
                  <Controller
                    control={control}
                    name="title"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('placeholder.itemTitle')}
                        value={value ?? ''}
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
                  <Text className="text-label text-text-muted uppercase">{t('field.notes')}</Text>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('placeholder.notes')}
                        value={value ?? ''}
                        onChangeText={(v) => onChange(v || null)}
                        onBlur={onBlur}
                        maxLength={500}
                        multiline
                        numberOfLines={3}
                      />
                    )}
                  />
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
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
