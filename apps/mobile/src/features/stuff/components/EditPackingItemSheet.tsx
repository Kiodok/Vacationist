import { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, Keyboard } from 'react-native';
import { ScrollView } from '@vacationist/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { updatePackingItemSchema, type UpdatePackingItemInput, type PackingCategory, type PackingItem } from '@vacationist/types';
import { getPackingCategoryLabel } from '../utils/categoryUtils';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { OptionPickerSheet } from '../../../components/OptionPickerSheet';

const CUSTOM_CATEGORY_VALUE = '__custom__';

interface EditPackingItemSheetProps {
  visible: boolean;
  item: PackingItem | null;
  categories: PackingCategory[];
  onClose: () => void;
  onSubmit: (itemId: string, input: UpdatePackingItemInput) => void;
  isPending: boolean;
}

export function EditPackingItemSheet({ visible, item, categories, onClose, onSubmit, isPending }: EditPackingItemSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';

  const seededNames = new Set(categories.map((c) => c.name));
  const isCustomCategory = (cat: string) => !seededNames.has(cat);

  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<UpdatePackingItemInput>({
    resolver: zodResolver(updatePackingItemSchema),
    defaultValues: { category: item?.category ?? '', title: item?.title ?? '', notes: item?.notes ?? null },
  });

  const selectedCategory = watch('category') ?? '';
  const categoryOptions = [
    ...categories.map((cat) => ({ value: cat.name, label: getPackingCategoryLabel(t, cat.name) })),
    // The item's own existing custom category (if any) so it stays selectable/visible in the list.
    ...(isCustomCategory(selectedCategory) && selectedCategory ? [{ value: selectedCategory, label: selectedCategory }] : []),
    { value: CUSTOM_CATEGORY_VALUE, label: t('categories.custom') },
  ];
  const categoryFieldLabel = showCustomCategory
    ? (selectedCategory || t('categories.custom'))
    : getPackingCategoryLabel(t, selectedCategory);

  useEffect(() => {
    if (visible && item) {
      const custom = isCustomCategory(item.category);
      setShowCustomCategory(custom);
      reset({ category: item.category, title: item.title, notes: item.notes ?? null });
    }
  }, [visible, item?.id]);

  const onValid = (data: UpdatePackingItemInput) => {
    if (!item) return;
    Keyboard.dismiss();
    onSubmit(item.id, data);
  };

  const handleClose = () => {
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
              <Text className="text-heading-m text-text-primary">{t('action.edit')}</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-md">
                {/* Category picker */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('field.category')}</Text>
                  <Pressable
                    onPress={() => setCategoryPickerVisible(true)}
                    className="bg-surface border border-border rounded-sm px-md py-sm flex-row items-center justify-between"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, minHeight: 48 })}
                  >
                    <Text className="text-body flex-1 text-text-primary" numberOfLines={1}>{categoryFieldLabel}</Text>
                    <ThemedIcon name="chevron-down" size={18} color={colors.textMuted} />
                  </Pressable>
                  <OptionPickerSheet
                    visible={categoryPickerVisible}
                    title={t('field.category')}
                    options={categoryOptions}
                    selectedValue={showCustomCategory ? CUSTOM_CATEGORY_VALUE : selectedCategory}
                    onSelect={(v) => {
                      if (v === CUSTOM_CATEGORY_VALUE) {
                        setShowCustomCategory(true);
                        if (!isCustomCategory(selectedCategory)) setValue('category', '');
                      } else {
                        setValue('category', v ?? '');
                        setShowCustomCategory(false);
                      }
                    }}
                    onClose={() => setCategoryPickerVisible(false)}
                  />
                  {showCustomCategory && (
                    <Controller
                      control={control}
                      name="category"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body mt-xs"
                          placeholderTextColor="#5C5C5C"
                          placeholder={t('placeholder.customCategory')}
                          value={value ?? ''}
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
                        value={value ?? ''}
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
