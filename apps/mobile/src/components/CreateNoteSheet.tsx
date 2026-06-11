import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { noteContentSchema, type NoteContentInput } from '@vacationist/types';

// Shared create sheet for entity-scoped notes (activity + accommodation notes).
// The namespace picks the feature-specific copy; form/validation/UI are identical.
export type NoteSheetNamespace = 'activityNotes' | 'accommodationNotes';

interface CreateNoteSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: NoteContentInput) => void;
  isPending: boolean;
  namespace: NoteSheetNamespace;
}

export function CreateNoteSheet({ visible, onClose, onSubmit, isPending, namespace }: CreateNoteSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(namespace);
  const { t: tCommon } = useTranslation('common');

  const { control, handleSubmit, reset, formState: { errors } } = useForm<NoteContentInput>({
    resolver: zodResolver(noteContentSchema),
    defaultValues: { content: '' },
  });

  const onValid = (data: NoteContentInput) => {
    Keyboard.dismiss();
    onSubmit(data);
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
