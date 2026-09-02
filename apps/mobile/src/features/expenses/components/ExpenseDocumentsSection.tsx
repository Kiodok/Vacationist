import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getExpenseDocumentUrl } from '@vacationist/api';
import { colors, ThemedIcon } from '@vacationist/ui';
import { useToastStore } from '../../../stores/toastStore';
import { isMutationBusy } from '../../../utils/mutationStatus';
import { downloadRemoteFile } from '../../../utils/share';
import { pickDocumentFile, readFileAsArrayBuffer, DocumentTooLargeError } from '../../../utils/documentPicker';
import { useExpenseDocuments, useUploadExpenseDocument, useDeleteExpenseDocument } from '../hooks/useExpenseDocuments';

interface ExpenseDocumentsSectionProps {
  tripId: string;
  expenseId: string;
  currentUserId: string | undefined;
  /** Organizer (or the expense creator, per canEdit upstream) — allowed to delete any document, not just their own upload. */
  canManage: boolean;
}

export function ExpenseDocumentsSection({ tripId, expenseId, currentUserId, canManage }: ExpenseDocumentsSectionProps) {
  const { t } = useTranslation('expenses');
  const { t: tCommon } = useTranslation('common');
  const addToast = useToastStore((s) => s.addToast);
  const { data: documents, isLoading } = useExpenseDocuments(expenseId);
  const uploadMutation = useUploadExpenseDocument(tripId, expenseId);
  const deleteMutation = useDeleteExpenseDocument(expenseId);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Alert.alert is a documented no-op on react-native-web (react-native-web's Alert.alert()
  // literally does nothing), so a per-row inline confirm is used instead — same pattern already
  // used for destructive actions elsewhere in this app (settings.tsx, transfer.tsx).
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    try {
      const file = await pickDocumentFile();
      if (!file) return;
      const fileData = await readFileAsArrayBuffer(file.uri);
      uploadMutation.mutate({ fileData, fileName: file.fileName, mimeType: file.mimeType });
    } catch (err) {
      if (err instanceof DocumentTooLargeError) {
        addToast('error', t('toast.documentTooLarge'));
      } else {
        addToast('error', t('toast.documentUploadFailed'));
      }
    }
  };

  const handleOpen = async (documentId: string, storagePath: string) => {
    setOpeningId(documentId);
    try {
      const url = await getExpenseDocumentUrl(storagePath);
      await Linking.openURL(url);
    } catch {
      addToast('error', t('toast.documentOpenFailed'));
    } finally {
      setOpeningId(null);
    }
  };

  const handleDownload = async (doc: { id: string; storage_path: string; file_name: string; mime_type: string }) => {
    setDownloadingId(doc.id);
    try {
      const url = await getExpenseDocumentUrl(doc.storage_path);
      await downloadRemoteFile(url, doc.file_name, doc.mime_type);
    } catch {
      addToast('error', t('toast.documentOpenFailed'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleConfirmDelete = (documentId: string, storagePath: string) => {
    deleteMutation.mutate({ documentId, storagePath });
    setConfirmingDeleteId(null);
  };

  return (
    <View className="gap-xs">
      <Text className="text-label text-text-muted uppercase">{t('field.documents')}</Text>

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : documents && documents.length > 0 ? (
        <View className="gap-xs">
          {documents.map((doc) => {
            const isImage = doc.mime_type.startsWith('image/');
            const canDelete = canManage || doc.uploaded_by === currentUserId;
            const isConfirming = confirmingDeleteId === doc.id;

            if (isConfirming) {
              return (
                <View key={doc.id} className="flex-row items-center gap-sm px-sm py-xs rounded-sm bg-surface">
                  <Text className="text-body-small text-text-secondary flex-1" numberOfLines={1}>
                    {t('confirm.deleteDocument')}
                  </Text>
                  <Pressable onPress={() => setConfirmingDeleteId(null)} className="px-sm py-xs rounded-sm bg-surface-elevated">
                    <Text className="text-body-small text-text-secondary">{tCommon('button.cancel')}</Text>
                  </Pressable>
                  <Pressable onPress={() => handleConfirmDelete(doc.id, doc.storage_path)} className="px-sm py-xs rounded-sm bg-danger">
                    <Text className="text-body-small text-white font-semibold">{tCommon('button.delete')}</Text>
                  </Pressable>
                </View>
              );
            }

            return (
              <View key={doc.id} className="flex-row items-center gap-xs px-sm py-xs rounded-sm bg-surface">
                <Pressable
                  onPress={() => handleOpen(doc.id, doc.storage_path)}
                  className="flex-1 flex-row items-center gap-xs"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  {openingId === doc.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <ThemedIcon name={isImage ? 'image-outline' : 'document-text-outline'} size={16} color={colors.primary} />
                  )}
                  <Text className="text-body-small text-text-primary flex-1" numberOfLines={1}>
                    {doc.file_name}
                  </Text>
                </Pressable>
                <Pressable onPress={() => handleDownload(doc)} disabled={downloadingId === doc.id} hitSlop={8}>
                  {downloadingId === doc.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <ThemedIcon name="download-outline" size={16} color={colors.primary} />
                  )}
                </Pressable>
                {canDelete && (
                  <Pressable onPress={() => setConfirmingDeleteId(doc.id)} hitSlop={8}>
                    <ThemedIcon name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <Text className="text-body-small text-text-muted">{t('field.noDocuments')}</Text>
      )}

      <Pressable
        onPress={handleAdd}
        disabled={isMutationBusy(uploadMutation)}
        className="flex-row items-center gap-xs self-start px-sm py-xs rounded-sm bg-primary/10"
        style={({ pressed }) => ({ opacity: pressed || isMutationBusy(uploadMutation) ? 0.6 : 1 })}
      >
        {isMutationBusy(uploadMutation) ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <ThemedIcon name="add-circle-outline" size={16} color={colors.primary} />
        )}
        <Text className="text-primary text-body-small font-medium">{t('action.addDocument')}</Text>
      </Pressable>
    </View>
  );
}
