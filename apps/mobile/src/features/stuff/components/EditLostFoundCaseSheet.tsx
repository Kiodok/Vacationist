import { useEffect } from 'react';
import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, ScrollView, Keyboard } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { updateLostFoundCaseSchema, type UpdateLostFoundCaseInput, type LostFoundCase } from '@vacationist/types';

interface EditLostFoundCaseSheetProps {
  visible: boolean;
  lostFoundCase: LostFoundCase | null;
  onClose: () => void;
  onSubmit: (caseId: string, input: UpdateLostFoundCaseInput) => void;
  isPending: boolean;
}

export function EditLostFoundCaseSheet({ visible, lostFoundCase: c, onClose, onSubmit, isPending }: EditLostFoundCaseSheetProps) {
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');

  const { control, handleSubmit, reset, formState: { errors } } = useForm<UpdateLostFoundCaseInput>({
    resolver: zodResolver(updateLostFoundCaseSchema),
    defaultValues: { title: c?.title ?? '', description: c?.description ?? null },
  });

  useEffect(() => {
    if (visible && c) {
      reset({ title: c.title, description: c.description ?? null });
    }
  }, [visible, c?.id]);

  const onValid = (data: UpdateLostFoundCaseInput) => {
    if (!c) return;
    Keyboard.dismiss();
    onSubmit(c.id, data);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl">
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
                        placeholder={t('placeholder.caseTitle')}
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
                  <Text className="text-label text-text-muted uppercase">{t('field.description')}</Text>
                  <Controller
                    control={control}
                    name="description"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('placeholder.description')}
                        value={value ?? ''}
                        onChangeText={(v) => onChange(v || null)}
                        onBlur={onBlur}
                        maxLength={1000}
                        multiline
                        numberOfLines={4}
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
