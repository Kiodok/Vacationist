import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, ScrollView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { createPackingItemSchema, type CreatePackingItemInput, type PackingCategory } from '@vacationist/types';
import { SEEDED_CATEGORY_I18N } from '../utils/categoryUtils';
import { colors } from '@vacationist/ui';

interface CreatePackingItemSheetProps {
  visible: boolean;
  categories: PackingCategory[];
  onClose: () => void;
  onSubmit: (input: CreatePackingItemInput) => void;
  isPending: boolean;
}

export function CreatePackingItemSheet({ visible, categories, onClose, onSubmit, isPending }: CreatePackingItemSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreatePackingItemInput>({
    resolver: zodResolver(createPackingItemSchema),
    defaultValues: { category: categories[0]?.name ?? 'Other', title: '', notes: null },
  });

  const selectedCategory = watch('category');
  // Persist the last-selected category so rapid consecutive creations stay in the same category.
  const lastCategoryRef = useRef(categories[0]?.name ?? 'Other');

  useEffect(() => {
    if (!visible) {
      reset({ category: lastCategoryRef.current, title: '', notes: null });
      setShowCustomCategory(false);
    }
  }, [visible]);

  const onValid = (data: CreatePackingItemInput) => {
    Keyboard.dismiss();
    lastCategoryRef.current = data.category;
    onSubmit(data);
  };

  const handleClose = () => {
    reset({ category: lastCategoryRef.current, title: '', notes: null });
    setShowCustomCategory(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">{tCommon('button.add')}</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-md">
                {/* Category picker */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('field.category')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-xs">
                    {categories.map((cat) => {
                      const isSelected = selectedCategory === cat.name && !showCustomCategory;
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={() => { setValue('category', cat.name); setShowCustomCategory(false); }}
                          className={`px-md py-sm rounded-full ${isSelected ? 'bg-primary' : 'bg-surface border border-border'}`}
                        >
                          <Text className={`text-body-small font-medium ${isSelected ? 'text-white' : 'text-text-secondary'}`}>
                            {(() => { const k = SEEDED_CATEGORY_I18N[cat.name]; return k ? t(k) : cat.name; })()}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => { setShowCustomCategory(true); setValue('category', ''); }}
                      className={`px-md py-sm rounded-full ${showCustomCategory ? 'bg-primary' : 'bg-surface border border-border'}`}
                    >
                      <Text className={`text-body-small font-medium ${showCustomCategory ? 'text-white' : 'text-text-secondary'}`}>
                        {t('categories.custom')}
                      </Text>
                    </Pressable>
                  </ScrollView>
                  {showCustomCategory && (
                    <Controller
                      control={control}
                      name="category"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body mt-xs"
                          placeholderTextColor="#5C5C5C"
                          placeholder={t('placeholder.customCategory')}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          maxLength={100}
                          autoFocus
                        />
                      )}
                    />
                  )}
                  {errors.category && (
                    <Text className="text-danger text-body-small">{errors.category.message}</Text>
                  )}
                </View>

                {/* Title */}
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

                {/* Notes */}
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
