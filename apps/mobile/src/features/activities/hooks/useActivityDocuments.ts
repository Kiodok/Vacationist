import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getActivityDocuments,
  uploadActivityDocument,
  deleteActivityDocument,
} from '@vacationist/api';
import type { ActivityDocument } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

type UploadDocumentArgs = { passengerUserId: string; fileData: Blob | ArrayBuffer; fileName: string; mimeType: string };
type DeleteDocumentArgs = { documentId: string; storagePath: string };

// Same shape as useTransferDocuments.ts's flight/public-transport hooks — deliberately not
// persisted (same reasoning as expense documents/transfer documents): replaying a stale file
// upload after reconnect makes no sense. No invalidateCostQueries call here — activity
// cost_estimate was removed from the cost analysis entirely in v1.39.2, so there's nothing
// cost-related to invalidate.

export function useActivityDocuments(activityId: string) {
  return useQuery({
    queryKey: ['activities', activityId, 'documents'],
    queryFn: () => getActivityDocuments(activityId),
    enabled: !!activityId,
    retry: 2,
  });
}

export function useUploadActivityDocument(tripId: string, activityId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ passengerUserId, fileData, fileName, mimeType }: UploadDocumentArgs) =>
      uploadActivityDocument(tripId, activityId, passengerUserId, fileData, fileName, mimeType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'documents'] });
      addToast('success', i18n.t('activities:toast.documentUploaded'));
    },
    onError: () => {
      addToast('error', i18n.t('activities:toast.documentUploadFailed'));
    },
  });
}

export function useDeleteActivityDocument(activityId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ documentId, storagePath }: DeleteDocumentArgs) => deleteActivityDocument(documentId, storagePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'documents'] });
      addToast('success', i18n.t('activities:toast.documentDeleted'));
    },
    onError: () => {
      addToast('error', i18n.t('activities:toast.documentDeleteFailed'));
    },
  });
}
