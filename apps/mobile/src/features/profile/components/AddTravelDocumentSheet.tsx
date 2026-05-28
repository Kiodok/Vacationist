import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { upsertTravelDocumentSchema, type UpsertTravelDocumentInput, DOCUMENT_TYPE } from '@vacationist/types';
import { DateTimePickerField } from '../../../components/DateTimePickerField';

const DOCUMENT_LABELS: Record<string, string> = {
  passport: 'Passport',
  id_card: 'ID Card',
};

interface AddTravelDocumentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: UpsertTravelDocumentInput) => void;
  isPending: boolean;
  existingTypes: string[];
}

export function AddTravelDocumentSheet({
  visible,
  onClose,
  onSubmit,
  isPending,
  existingTypes,
}: AddTravelDocumentSheetProps) {
  const { t } = useTranslation('profile');
  const { t: tCommon } = useTranslation('common');
  const availableTypes = DOCUMENT_TYPE.filter((t) => !existingTypes.includes(t));
  const defaultType = availableTypes[0] ?? 'passport';

  const { control, handleSubmit, reset, formState: { errors } } = useForm<UpsertTravelDocumentInput>({
    resolver: zodResolver(upsertTravelDocumentSchema),
    defaultValues: { document_type: defaultType },
  });

  const onValid = (data: UpsertTravelDocumentInput) => {
    Keyboard.dismiss();
    onSubmit(data);
    reset({ document_type: defaultType });
  };

  const handleClose = () => {
    reset({ document_type: defaultType });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl max-h-[90%]">
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-lg">
              <Text className="text-heading-m text-text-primary font-semibold">Add Document</Text>
              <Pressable onPress={handleClose} hitSlop={12}>
                <Text className="text-body text-text-secondary">{tCommon('button.cancel')}</Text>
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View className="gap-md pb-md">
                {/* Document type picker */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Document Type</Text>
                  <Controller
                    control={control}
                    name="document_type"
                    render={({ field: { onChange, value } }) => (
                      <View className="flex-row gap-sm">
                        {DOCUMENT_TYPE.map((type) => {
                          const disabled = existingTypes.includes(type);
                          return (
                            <Pressable
                              key={type}
                              onPress={() => !disabled && onChange(type)}
                              disabled={disabled}
                              className={`flex-1 min-h-[44px] rounded-sm border items-center justify-center ${
                                disabled
                                  ? 'bg-surface/50 border-border opacity-40'
                                  : value === type
                                  ? 'bg-primary/20 border-primary'
                                  : 'bg-surface border-border'
                              }`}
                            >
                              <Text
                                className={`text-body-small font-medium ${
                                  value === type ? 'text-primary' : 'text-text-secondary'
                                }`}
                              >
                                {DOCUMENT_LABELS[type]}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  />
                </View>

                {/* Full legal name */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Full Legal Name *</Text>
                  <Controller
                    control={control}
                    name="full_legal_name"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md min-h-[44px] text-body text-text-primary"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="As printed on document"
                        placeholderTextColor="#5C5C5C"
                        autoCapitalize="words"
                      />
                    )}
                  />
                  {errors.full_legal_name && (
                    <Text className="text-body-small text-danger">{errors.full_legal_name.message}</Text>
                  )}
                </View>

                {/* Document number */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Document Number *</Text>
                  <Controller
                    control={control}
                    name="document_number"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md min-h-[44px] text-body text-text-primary"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="e.g. X1234567"
                        placeholderTextColor="#5C5C5C"
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />
                    )}
                  />
                  {errors.document_number && (
                    <Text className="text-body-small text-danger">{errors.document_number.message}</Text>
                  )}
                </View>

                {/* Date of birth */}
                <Controller
                  control={control}
                  name="date_of_birth"
                  render={({ field: { onChange, value } }) => (
                    <DateTimePickerField
                      label="Date of Birth"
                      value={value ?? null}
                      onChange={onChange}
                      mode="date"
                      placeholder="Select date"
                      error={errors.date_of_birth?.message}
                    />
                  )}
                />

                {/* Nationality */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Nationality (ISO code)</Text>
                  <Controller
                    control={control}
                    name="nationality"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md min-h-[44px] text-body text-text-primary"
                        value={value ?? ''}
                        onChangeText={(v) => onChange(v.toUpperCase().slice(0, 2))}
                        onBlur={onBlur}
                        placeholder="e.g. DE"
                        placeholderTextColor="#5C5C5C"
                        autoCapitalize="characters"
                        maxLength={2}
                      />
                    )}
                  />
                  {errors.nationality && (
                    <Text className="text-body-small text-danger">{errors.nationality.message}</Text>
                  )}
                </View>

                {/* Issuing country */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Issuing Country (ISO code)</Text>
                  <Controller
                    control={control}
                    name="issuing_country"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md min-h-[44px] text-body text-text-primary"
                        value={value ?? ''}
                        onChangeText={(v) => onChange(v.toUpperCase().slice(0, 2))}
                        onBlur={onBlur}
                        placeholder="e.g. DE"
                        placeholderTextColor="#5C5C5C"
                        autoCapitalize="characters"
                        maxLength={2}
                      />
                    )}
                  />
                </View>

                {/* Expiry date */}
                <Controller
                  control={control}
                  name="expiry_date"
                  render={({ field: { onChange, value } }) => (
                    <DateTimePickerField
                      label="Expiry Date"
                      value={value ?? null}
                      onChange={onChange}
                      mode="date"
                      placeholder="Select date"
                      error={errors.expiry_date?.message}
                    />
                  )}
                />

                {/* Notes */}
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Notes</Text>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-body text-text-primary"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="Optional notes"
                        placeholderTextColor="#5C5C5C"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                    )}
                  />
                </View>
              </View>
            </ScrollView>

            <Pressable
              onPress={handleSubmit(onValid)}
              disabled={isPending}
              className={`mt-md min-h-[48px] rounded-sm items-center justify-center ${
                isPending ? 'bg-primary/50' : 'bg-primary'
              }`}
            >
              <Text className="text-body text-white font-semibold">
                {isPending ? 'Saving…' : 'Save Document'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
