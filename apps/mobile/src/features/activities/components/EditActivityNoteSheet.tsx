import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@vacationist/ui';
import { updateActivityNoteSchema, type UpdateActivityNoteInput, type ActivityNote } from '@vacationist/types';

interface EditActivityNoteSheetProps {
  visible: boolean;
  note: ActivityNote;
  canDelete: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateActivityNoteInput) => void;
  onDelete: () => void;
  isUpdatePending: boolean;
  isDeletePending: boolean;
}

export function EditActivityNoteSheet({
  visible,
  note,
  canDelete,
  onClose,
  onSubmit,
  onDelete,
  isUpdatePending,
  isDeletePending,
}: EditActivityNoteSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('activityNotes');
  const { t: tCommon } = useTranslation('common');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<UpdateActivityNoteInput>({
    resolver: zodResolver(updateActivityNoteSchema),
    defaultValues: { content: note.content },
  });

  const onValid = (data: UpdateActivityNoteInput) => {
    Keyboard.dismiss();
    onSubmit(data);
  };

  const handleClose = () => {
    setConfirmDelete(false);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">{t('edit.title')}</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-md">
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('field.content')} *</Text>
                  <Controller
                    control={control}
                    name="content"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder={t('placeholder.content')}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        maxLength={1000}
                        multiline
                        numberOfLines={5}
                        style={{ textAlignVertical: 'top', minHeight: 120 }}
                        autoFocus
                      />
                    )}
                  />
                  {errors.content && (
                    <Text className="text-danger text-body-small">{errors.content.message}</Text>
                  )}
                </View>

                <Pressable
                  onPress={handleSubmit(onValid)}
                  disabled={isUpdatePending}
                  className={`items-center py-sm rounded-md ${isUpdatePending ? 'bg-primary/50' : 'bg-primary'}`}
                  style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-white text-body font-semibold">
                    {isUpdatePending ? tCommon('label.saving') : tCommon('button.save')}
                  </Text>
                </Pressable>

                {canDelete && !confirmDelete && (
                  <Pressable
                    onPress={() => setConfirmDelete(true)}
                    className="flex-row items-center justify-center gap-xs py-sm"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text className="text-danger text-body-small font-semibold">{tCommon('button.delete')}</Text>
                  </Pressable>
                )}

                {canDelete && confirmDelete && (
                  <View className="rounded-md border border-danger p-md gap-sm">
                    <Text className="text-body-small text-text-secondary text-center">
                      {t('confirm.delete')}
                    </Text>
                    <View className="flex-row gap-sm">
                      <Pressable
                        onPress={() => setConfirmDelete(false)}
                        className="flex-1 min-h-[44px] rounded-md border border-border items-center justify-center"
                        disabled={isDeletePending}
                      >
                        <Text className="text-body text-text-secondary">{tCommon('button.cancel')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={onDelete}
                        className="flex-1 min-h-[44px] rounded-md bg-danger items-center justify-center"
                        disabled={isDeletePending}
                      >
                        {isDeletePending ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text className="text-body text-white font-semibold">{tCommon('button.delete')}</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
