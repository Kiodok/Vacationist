import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, ScrollView, Keyboard } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { createSharedPackingItemSchema, type CreateSharedPackingItemInput, SHARED_PACKING_ITEM_TYPE, type SharedPackingItemType } from '@vacationist/types';

interface CreateSharedPackingItemSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateSharedPackingItemInput) => void;
  isPending: boolean;
}

const TYPE_COLORS: Record<SharedPackingItemType, string> = {
  i_got_it: 'bg-success',
  who_has: 'bg-warning',
  everyone: 'bg-primary',
};

const TYPE_COLORS_INACTIVE = 'bg-surface border border-border';

export function CreateSharedPackingItemSheet({ visible, onClose, onSubmit, isPending }: CreateSharedPackingItemSheetProps) {
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreateSharedPackingItemInput>({
    resolver: zodResolver(createSharedPackingItemSchema),
    defaultValues: { title: '', item_type: 'i_got_it', notes: null },
  });

  const selectedType = watch('item_type');

  const typeLabels: Record<SharedPackingItemType, string> = {
    i_got_it: t('itemType.iGotIt'),
    who_has: t('itemType.whoHas'),
    everyone: t('itemType.everyone'),
  };

  const onValid = (data: CreateSharedPackingItemInput) => {
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
          <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl">
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
                {/* Item type picker */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('field.itemType')}</Text>
                  <View className="flex-row gap-xs">
                    {SHARED_PACKING_ITEM_TYPE.map((type) => {
                      const isSelected = selectedType === type;
                      return (
                        <Pressable
                          key={type}
                          onPress={() => setValue('item_type', type)}
                          className={`flex-1 py-sm rounded-full items-center ${isSelected ? TYPE_COLORS[type] : TYPE_COLORS_INACTIVE}`}
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                          <Text className={`text-body-small font-semibold ${isSelected ? 'text-white' : 'text-text-secondary'}`}>
                            {typeLabels[type]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {errors.item_type && (
                    <Text className="text-danger text-body-small">{errors.item_type.message}</Text>
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
                        autoFocus
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
