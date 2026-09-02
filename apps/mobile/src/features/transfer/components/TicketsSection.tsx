import { useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { UseMutationResult } from '@tanstack/react-query';
import { getTransferDocumentUrl } from '@vacationist/api';
import type { TransferDocument } from '@vacationist/types';
import { colors, ThemedIcon } from '@vacationist/ui';
import { useToastStore } from '../../../stores/toastStore';
import { isMutationBusy } from '../../../utils/mutationStatus';
import { pickDocumentFile, readFileAsArrayBuffer, DocumentTooLargeError } from '../../../utils/documentPicker';

type UploadTicketArgs = { passengerUserId: string; fileData: Blob | ArrayBuffer; fileName: string; mimeType: string };
type DeleteTicketArgs = { documentId: string; storagePath: string };

interface TicketsSectionProps {
  documents: TransferDocument[] | undefined;
  uploadMutation: UseMutationResult<TransferDocument, unknown, UploadTicketArgs>;
  deleteMutation: UseMutationResult<void, unknown, DeleteTicketArgs>;
  /** Every trip member, not just assigned passengers — a ticket can be attached before formal
   * passenger assignment (flights) or is open to everyone (public transport, no passenger
   * concept at all). */
  members: { user_id: string; name: string }[];
  currentUserId: string | undefined;
  /** Organizer — allowed to upload/replace/delete any member's ticket, not just their own. */
  isOrganizer: boolean;
}

/**
 * Generic per-passenger ticket row list, shared by FlightTicketsSection and
 * PublicTransportTicketsSection — the two were previously near-identical copies of this exact
 * component, differing only in which entity-specific hooks fed the query/mutations in. Callers
 * own the hooks (each entity type has its own query key / RPC), this component owns only the
 * upload/open/delete UI and interaction logic.
 */
export function TicketsSection({ documents, uploadMutation, deleteMutation, members, currentUserId, isOrganizer }: TicketsSectionProps) {
  const { t } = useTranslation('transfer');
  const { t: tCommon } = useTranslation('common');
  const addToast = useToastStore((s) => s.addToast);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [openingUserId, setOpeningUserId] = useState<string | null>(null);
  // Alert.alert is a documented no-op on react-native-web, so a per-row inline confirm is used
  // instead — same fix and reasoning as ExpenseDocumentsSection.
  const [confirmingDeleteUserId, setConfirmingDeleteUserId] = useState<string | null>(null);

  const documentsByUserId = new Map((documents ?? []).map((d) => [d.user_id, d]));

  const handleUpload = async (passengerUserId: string) => {
    try {
      const file = await pickDocumentFile();
      if (!file) return;
      setBusyUserId(passengerUserId);
      const fileData = await readFileAsArrayBuffer(file.uri);
      uploadMutation.mutate(
        { passengerUserId, fileData, fileName: file.fileName, mimeType: file.mimeType },
        { onSettled: () => setBusyUserId(null) },
      );
    } catch (err) {
      setBusyUserId(null);
      if (err instanceof DocumentTooLargeError) {
        addToast('error', t('toast.documentTooLarge'));
      } else {
        addToast('error', t('toast.documentUploadFailed'));
      }
    }
  };

  const handleOpen = async (userId: string, storagePath: string) => {
    setOpeningUserId(userId);
    try {
      const url = await getTransferDocumentUrl(storagePath);
      await Linking.openURL(url);
    } catch {
      addToast('error', t('toast.documentOpenFailed'));
    } finally {
      setOpeningUserId(null);
    }
  };

  const handleConfirmDelete = (documentId: string, storagePath: string) => {
    deleteMutation.mutate({ documentId, storagePath });
    setConfirmingDeleteUserId(null);
  };

  return (
    <View className="gap-xs">
      <Text className="text-label text-text-muted uppercase">{t('field.ticket')}</Text>
      <View className="gap-xs">
        {members.map((member) => {
          const doc = documentsByUserId.get(member.user_id);
          const canManage = isOrganizer || member.user_id === currentUserId;
          const isBusy = busyUserId === member.user_id && isMutationBusy(uploadMutation);
          const isConfirming = confirmingDeleteUserId === member.user_id;

          if (isConfirming && doc) {
            return (
              <View key={member.user_id} className="flex-row items-center gap-sm px-sm py-xs rounded-sm bg-surface">
                <Text className="text-body-small text-text-secondary flex-1" numberOfLines={1}>
                  {t('confirm.deleteDocument')}
                </Text>
                <Pressable onPress={() => setConfirmingDeleteUserId(null)} className="px-sm py-xs rounded-sm bg-surface-elevated">
                  <Text className="text-body-small text-text-secondary">{tCommon('button.cancel')}</Text>
                </Pressable>
                <Pressable onPress={() => handleConfirmDelete(doc.id, doc.storage_path)} className="px-sm py-xs rounded-sm bg-danger">
                  <Text className="text-body-small text-white font-semibold">{tCommon('button.delete')}</Text>
                </Pressable>
              </View>
            );
          }

          return (
            // TouchableOpacity + static styles throughout, not Pressable + function style: a
            // function `style` prop on a flex-row Pressable doesn't lay out reliably on Android
            // (see the pressable-flex-android note) — that's what hid the Replace/Delete controls
            // on the ticket rows.
            <View key={member.user_id} className="flex-row items-center gap-xs px-sm rounded-sm bg-surface" style={{ minHeight: 44 }}>
              {doc ? (
                <>
                  {/* The whole name + icon region opens the document — a bare 16px icon was too
                     small a target next to the Replace button (v1.33.0 fix). */}
                  <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={() => handleOpen(member.user_id, doc.storage_path)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}
                  >
                    {openingUserId === member.user_id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <ThemedIcon name={doc.mime_type.startsWith('image/') ? 'image-outline' : 'document-text-outline'} size={20} color={colors.primary} />
                    )}
                    <Text className="text-body-small text-text-secondary" style={{ flex: 1 }} numberOfLines={1}>
                      {member.name}
                    </Text>
                  </TouchableOpacity>
                  {canManage && (
                    <TouchableOpacity
                      activeOpacity={0.6}
                      onPress={() => handleUpload(member.user_id)}
                      disabled={isBusy}
                      hitSlop={8}
                      style={{ paddingHorizontal: 8, paddingVertical: 10, opacity: isBusy ? 0.6 : 1 }}
                    >
                      {isBusy ? <ActivityIndicator size="small" color={colors.primary} /> : (
                        <Text className="text-primary text-body-small font-medium">{t('action.replaceTicket')}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {canManage && (
                    <TouchableOpacity
                      activeOpacity={0.6}
                      onPress={() => setConfirmingDeleteUserId(member.user_id)}
                      hitSlop={8}
                      style={{ paddingHorizontal: 8, paddingVertical: 10 }}
                    >
                      <ThemedIcon name="trash-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <Text className="text-body-small text-text-secondary" style={{ flex: 1, paddingVertical: 10 }} numberOfLines={1}>
                    {member.name}
                  </Text>
                  {canManage ? (
                    <TouchableOpacity
                      activeOpacity={0.6}
                      onPress={() => handleUpload(member.user_id)}
                      disabled={isBusy}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 10, opacity: isBusy ? 0.6 : 1 }}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <ThemedIcon name="add-circle-outline" size={18} color={colors.primary} />
                      )}
                      <Text className="text-primary text-body-small font-medium">{t('action.addTicket')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text className="text-body-small text-text-muted" style={{ paddingVertical: 10 }}>{t('field.noTicket')}</Text>
                  )}
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
