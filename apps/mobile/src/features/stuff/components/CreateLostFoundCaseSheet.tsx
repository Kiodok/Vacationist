import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, ScrollView, Keyboard } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { createLostFoundCaseSchema, type CreateLostFoundCaseInput, LOST_FOUND_CASE_TYPE, type LostFoundCaseType } from '@vacationist/types';
import type { TripMemberWithUser } from '@vacationist/api';

interface CreateLostFoundCaseSheetProps {
  visible: boolean;
  members: TripMemberWithUser[];
  currentUserId: string | undefined;
  onClose: () => void;
  onSubmit: (input: CreateLostFoundCaseInput) => void;
  isPending: boolean;
}

const CASE_TYPE_ICONS: Record<LostFoundCaseType, string> = {
  lost_unknown: '❓',
  lost_known: '🔎',
  found_unknown: '📦',
  found_owner_known: '✅',
};

export function CreateLostFoundCaseSheet({ visible, members, currentUserId, onClose, onSubmit, isPending }: CreateLostFoundCaseSheetProps) {
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');

  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreateLostFoundCaseInput>({
    resolver: zodResolver(createLostFoundCaseSchema),
    defaultValues: { case_type: 'lost_unknown', title: '', description: null, target_user: null },
  });

  const selectedCaseType = watch('case_type');
  const needsTargetUser = selectedCaseType === 'lost_known' || selectedCaseType === 'found_owner_known';

  const caseTypeLabels: Record<LostFoundCaseType, string> = {
    lost_unknown: t('caseType.lostUnknown'),
    lost_known: t('caseType.lostKnown'),
    found_unknown: t('caseType.foundUnknown'),
    found_owner_known: t('caseType.foundOwnerKnown'),
  };

  const otherMembers = members.filter((m) => m.user_id !== currentUserId);

  const onValid = (data: CreateLostFoundCaseInput) => {
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
              <Text className="text-heading-m text-text-primary">{t('field.caseType')}</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-md">
                {/* Case type picker */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">{t('field.caseType')}</Text>
                  <View className="flex-row flex-wrap gap-xs">
                    {LOST_FOUND_CASE_TYPE.map((type) => {
                      const isSelected = selectedCaseType === type;
                      return (
                        <Pressable
                          key={type}
                          onPress={() => { setValue('case_type', type); if (!needsTargetUser) setValue('target_user', null); }}
                          className={`flex-row items-center gap-xs px-md py-sm rounded-full ${isSelected ? 'bg-primary' : 'bg-surface border border-border'}`}
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                          <Text>{CASE_TYPE_ICONS[type]}</Text>
                          <Text className={`text-body-small font-medium ${isSelected ? 'text-white' : 'text-text-secondary'}`}>
                            {caseTypeLabels[type]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Target user picker (only for known cases) */}
                {needsTargetUser && otherMembers.length > 0 && (
                  <View className="gap-xs">
                    <Text className="text-label text-text-muted uppercase">{t('field.targetMember')}</Text>
                    <Controller
                      control={control}
                      name="target_user"
                      render={({ field: { value } }) => (
                        <View className="flex-row flex-wrap gap-xs">
                          {otherMembers.map((m) => {
                            const isSelected = value === m.user_id;
                            return (
                              <Pressable
                                key={m.user_id}
                                onPress={() => setValue('target_user', isSelected ? null : m.user_id)}
                                className={`px-md py-sm rounded-full ${isSelected ? 'bg-primary' : 'bg-surface border border-border'}`}
                                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                              >
                                <Text className={`text-body-small font-medium ${isSelected ? 'text-white' : 'text-text-secondary'}`}>
                                  {m.user.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    />
                  </View>
                )}

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
                        placeholder={t('placeholder.caseTitle')}
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

                {/* Description */}
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
