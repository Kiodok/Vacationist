import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { createPreworkTopicSchema, type CreatePreworkTopicInput } from '@vacationist/types';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';

interface CreateTopicSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreatePreworkTopicInput) => void;
  isPending: boolean;
}

export function CreateTopicSheet({ visible, onClose, onSubmit, isPending }: CreateTopicSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('prework');
  const { t: tCommon } = useTranslation('common');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [seededLabels, setSeededLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');

  const titleTrimmed = title.trim();
  const canSubmit = titleTrimmed.length >= 1 && titleTrimmed.length <= 100;

  const handleAddLabel = () => {
    const trimmed = labelInput.trim();
    if (!trimmed || trimmed.length > 100) return;
    if (seededLabels.some((l) => l.toLowerCase() === trimmed.toLowerCase())) return;
    if (seededLabels.length >= 20) return;
    setSeededLabels((prev) => [...prev, trimmed]);
    setLabelInput('');
  };

  const handleRemoveLabel = (label: string) => {
    setSeededLabels((prev) => prev.filter((l) => l !== label));
  };

  const handleSubmit = () => {
    Keyboard.dismiss();
    const input: CreatePreworkTopicInput = {
      title: titleTrimmed,
      description: description.trim() || undefined,
      seeded_labels: seededLabels.length > 0 ? seededLabels : undefined,
    };
    const result = createPreworkTopicSchema.safeParse(input);
    if (!result.success) return;
    onSubmit(result.data);
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setSeededLabels([]);
    setLabelInput('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[90%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">{t('topic.createTitle')}</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-md">
                {/* Title */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('topic.field.title')} *</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t('topic.placeholder.title')}
                    placeholderTextColor="#5C5C5C"
                    maxLength={100}
                    autoFocus
                    returnKeyType="next"
                    className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                  />
                </View>

                {/* Description */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('topic.field.description')}</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t('topic.placeholder.description')}
                    placeholderTextColor="#5C5C5C"
                    maxLength={500}
                    multiline
                    numberOfLines={3}
                    className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                    style={{ textAlignVertical: 'top', minHeight: 72 }}
                  />
                </View>

                {/* Seeded labels */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('topic.field.seededLabels')}</Text>
                  <Text className="text-body-small text-text-secondary">{t('topic.seededLabelsHint')}</Text>

                  {seededLabels.length > 0 && (
                    <View className="flex-row flex-wrap gap-xs">
                      {seededLabels.map((label) => (
                        <View key={label} className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-primary/10 border border-primary/20">
                          <Text className="text-body-small text-primary">{label}</Text>
                          <Pressable onPress={() => handleRemoveLabel(label)} hitSlop={8}>
                            <ThemedIcon name="close-circle" size={14} color={colors.primary} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  <View className="flex-row items-center gap-sm">
                    <TextInput
                      value={labelInput}
                      onChangeText={setLabelInput}
                      placeholder={t('topic.placeholder.seededLabel')}
                      placeholderTextColor="#5C5C5C"
                      maxLength={100}
                      onSubmitEditing={handleAddLabel}
                      returnKeyType="done"
                      className="flex-1 bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                    />
                    <Pressable
                      onPress={handleAddLabel}
                      disabled={!labelInput.trim()}
                      className={`px-md py-sm rounded-md ${labelInput.trim() ? 'bg-primary' : 'bg-surface border border-border'}`}
                    >
                      <ThemedIcon
                        name="add"
                        size={20}
                        color={labelInput.trim() ? (isColorful ? colors.surface : '#FFFFFF') : '#5C5C5C'}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Submit */}
                <Pressable
                  onPress={handleSubmit}
                  disabled={!canSubmit || isPending}
                  className={`items-center py-sm rounded-md ${canSubmit && !isPending ? 'bg-primary' : 'bg-primary/50'}`}
                  style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-body font-semibold" style={{ color: isColorful ? colors.surface : '#FFFFFF' }}>
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
