import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon } from '@vacationist/ui';
import { useToastStore } from '../../../stores/toastStore';
import {
  pickDocumentFile,
  pickDocumentFromCamera,
  DocumentTooLargeError,
  CameraPermissionDeniedError,
  type PickedDocumentFile,
} from '../../../utils/documentPicker';

interface StagedDocumentsFieldProps {
  files: PickedDocumentFile[];
  onChange: (files: PickedDocumentFile[]) => void;
}

/**
 * Document picker for a NEW expense that doesn't have an id yet (CreateExpenseSheet) — holds
 * picked/captured files in local state only, nothing hits Storage here. The caller uploads each
 * staged file once the real expense id exists (see CreateExpenseSheet's onSubmit and
 * expenses.tsx's handleCreate). An already-existing expense uses ExpenseDocumentsSection
 * instead, which uploads immediately since it has a real expenseId to attach to.
 */
export function StagedDocumentsField({ files, onChange }: StagedDocumentsFieldProps) {
  const { t } = useTranslation('expenses');
  const addToast = useToastStore((s) => s.addToast);

  const handleAdd = async () => {
    try {
      const file = await pickDocumentFile();
      if (file) onChange([...files, file]);
    } catch (err) {
      addToast('error', err instanceof DocumentTooLargeError ? t('toast.documentTooLarge') : t('toast.documentUploadFailed'));
    }
  };

  const handleTakePhoto = async () => {
    try {
      const file = await pickDocumentFromCamera();
      if (file) onChange([...files, file]);
    } catch (err) {
      if (err instanceof DocumentTooLargeError) addToast('error', t('toast.documentTooLarge'));
      else if (err instanceof CameraPermissionDeniedError) addToast('error', t('toast.cameraPermissionDenied'));
      else addToast('error', t('toast.documentUploadFailed'));
    }
  };

  const removeAt = (index: number) => onChange(files.filter((_, i) => i !== index));

  return (
    <View className="gap-xs">
      <Text className="text-label text-text-muted uppercase">{t('field.documents')}</Text>

      {files.length > 0 && (
        <View className="gap-xs">
          {files.map((file, index) => (
            // TouchableOpacity + static styles, not Pressable + function style (unreliable in a
            // flex row on Android — see pressable-flex-android).
            <View key={`${file.uri}-${index}`} className="flex-row items-center gap-xs px-sm rounded-sm bg-surface" style={{ minHeight: 44 }}>
              <ThemedIcon name={file.mimeType.startsWith('image/') ? 'image-outline' : 'document-text-outline'} size={20} color={colors.primary} />
              <Text className="text-body-small text-text-primary flex-1" numberOfLines={1}>
                {file.fileName}
              </Text>
              <TouchableOpacity activeOpacity={0.6} onPress={() => removeAt(index)} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 10 }}>
                <ThemedIcon name="close-circle-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View className="flex-row gap-sm">
        <Pressable
          onPress={handleAdd}
          className="flex-row items-center gap-xs self-start px-sm py-xs rounded-sm bg-primary/10"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ThemedIcon name="add-circle-outline" size={16} color={colors.primary} />
          <Text className="text-primary text-body-small font-medium">{t('action.addDocument')}</Text>
        </Pressable>
        <Pressable
          onPress={handleTakePhoto}
          className="flex-row items-center gap-xs self-start px-sm py-xs rounded-sm bg-primary/10"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <ThemedIcon name="camera-outline" size={16} color={colors.primary} />
          <Text className="text-primary text-body-small font-medium">{t('action.takePhoto')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
