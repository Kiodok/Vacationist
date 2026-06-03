import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateShoppingItemSchema, type UpdateShoppingItemInput, type ShoppingItem } from '@vacationist/types';

interface EditShoppingItemSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateShoppingItemInput) => void;
  onDelete?: () => void;
  isPending: boolean;
  item: ShoppingItem;
  canEdit: boolean;
  canDelete: boolean;
}

export function EditShoppingItemSheet({
  visible,
  onClose,
  onSubmit,
  onDelete,
  isPending,
  item,
  canEdit,
  canDelete,
}: EditShoppingItemSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('shopping');
  const { t: tCommon } = useTranslation('common');
  const [quantityText, setQuantityText] = useState(
    item.quantity != null ? String(item.quantity) : '',
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<UpdateShoppingItemInput>({
    resolver: zodResolver(updateShoppingItemSchema),
    defaultValues: {
      title: item.title,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes,
    },
  });

  const onValid = (data: UpdateShoppingItemInput) => {
    Keyboard.dismiss();
    onSubmit(data);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-background/80"
          onPress={onClose}
        />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">
              {canEdit ? 'Edit Item' : 'Item Details'}
            </Text>
            <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="gap-md">
              {/* Title */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">Title</Text>
                <Controller
                  control={control}
                  name="title"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      maxLength={100}
                      editable={canEdit}
                    />
                  )}
                />
                {errors.title && (
                  <Text className="text-danger text-body-small">{errors.title.message}</Text>
                )}
              </View>

              {/* Quantity + Unit row */}
              <View className="flex-row gap-sm">
                <View className="flex-1 gap-xs">
                  <Text className="text-label text-text-muted uppercase">Quantity</Text>
                  <Controller
                    control={control}
                    name="quantity"
                    render={({ field: { onChange } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="0"
                        value={quantityText}
                        onChangeText={(t) => {
                          const cleaned = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').replace(/(\.\d{2}).+/, '$1');
                          setQuantityText(cleaned);
                          const num = parseFloat(cleaned);
                          onChange(isNaN(num) ? null : num);
                        }}
                        keyboardType="decimal-pad"
                        editable={canEdit}
                      />
                    )}
                  />
                </View>
                <View className="flex-1 gap-xs">
                  <Text className="text-label text-text-muted uppercase">Unit</Text>
                  <Controller
                    control={control}
                    name="unit"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="e.g. kg, pcs"
                        value={value ?? ''}
                        onChangeText={(t) => onChange(t || null)}
                        maxLength={50}
                        editable={canEdit}
                      />
                    )}
                  />
                </View>
              </View>

              {/* Notes */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">Notes</Text>
                <Controller
                  control={control}
                  name="notes"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder="Any additional info..."
                      value={value ?? ''}
                      onChangeText={(t) => onChange(t || null)}
                      onBlur={onBlur}
                      multiline
                      numberOfLines={2}
                      maxLength={500}
                      style={{ minHeight: 60, textAlignVertical: 'top' }}
                      editable={canEdit}
                    />
                  )}
                />
              </View>

              {/* Actions */}
              <View className="gap-sm mt-sm">
                {canEdit && (
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
                )}

                {canDelete && (
                  confirmingDelete ? (
                    <View className="flex-row items-center justify-center gap-sm">
                      <Text className="text-text-secondary text-body-small">Delete this item?</Text>
                      <Pressable
                        onPress={() => { onDelete?.(); setConfirmingDelete(false); }}
                        className="px-md py-xs rounded-sm bg-danger/20"
                      >
                        <Text className="text-danger text-body-small font-semibold">Yes, delete</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setConfirmingDelete(false)}
                        className="px-md py-xs rounded-sm"
                      >
                        <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setConfirmingDelete(true)}
                      className="flex-row items-center justify-center gap-xs py-sm rounded-md bg-danger/10"
                      style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text className="text-danger text-body font-medium">Delete Item</Text>
                    </Pressable>
                  )
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
