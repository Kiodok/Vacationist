import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  getTransferFlightDocuments,
  uploadTransferFlightDocument,
  deleteTransferFlightDocument,
  getPublicTransportDocuments,
  uploadPublicTransportDocument,
  deletePublicTransportDocument,
} from '@vacationist/api';
import type { TransferDocument } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';
import { invalidateCostQueries } from '../../../utils/queryClient';

type UploadTicketArgs = { passengerUserId: string; fileData: Blob | ArrayBuffer; fileName: string; mimeType: string };
type DeleteTicketArgs = { documentId: string; storagePath: string };

// Generic triad shared by flight tickets and public-transport tickets below — the two entity
// types previously duplicated the same query/upload/delete hook bodies verbatim, differing only
// in query key and which API function backs each. Deliberately not persisted (same reasoning as
// expense documents/avatars/travel documents) — replaying a stale file upload after reconnect
// makes no sense.

function useDocumentsQuery(queryKey: QueryKey, queryFn: () => Promise<TransferDocument[]>, enabled: boolean) {
  return useQuery({ queryKey, queryFn, enabled, retry: 2 });
}

function useUploadDocumentMutation(
  queryKey: QueryKey,
  tripId: string,
  uploadFn: (args: UploadTicketArgs) => Promise<TransferDocument>,
) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: uploadFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // A ticket counts toward that flight/PT entry's cost (v1.34.1 tasks 3/4).
      invalidateCostQueries(tripId);
      addToast('success', i18n.t('transfer:toast.documentUploaded'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.documentUploadFailed'));
    },
  });
}

function useDeleteDocumentMutation(
  queryKey: QueryKey,
  tripId: string,
  deleteFn: (args: DeleteTicketArgs) => Promise<void>,
) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      invalidateCostQueries(tripId);
      addToast('success', i18n.t('transfer:toast.documentDeleted'));
    },
    onError: () => {
      addToast('error', i18n.t('transfer:toast.documentDeleteFailed'));
    },
  });
}

// --- Flight tickets ---

export function useTransferFlightDocuments(flightId: string) {
  return useDocumentsQuery(
    ['transfer-flights', flightId, 'documents'],
    () => getTransferFlightDocuments(flightId),
    !!flightId,
  );
}

export function useUploadTransferFlightDocument(tripId: string, flightId: string) {
  return useUploadDocumentMutation(
    ['transfer-flights', flightId, 'documents'],
    tripId,
    ({ passengerUserId, fileData, fileName, mimeType }) =>
      uploadTransferFlightDocument(tripId, flightId, passengerUserId, fileData, fileName, mimeType),
  );
}

export function useDeleteTransferFlightDocument(tripId: string, flightId: string) {
  return useDeleteDocumentMutation(
    ['transfer-flights', flightId, 'documents'],
    tripId,
    ({ documentId, storagePath }) => deleteTransferFlightDocument(documentId, storagePath),
  );
}

// --- Public transport tickets — same shape as flight tickets above ---

export function usePublicTransportDocuments(publicTransportId: string) {
  return useDocumentsQuery(
    ['transfer-public-transport', publicTransportId, 'documents'],
    () => getPublicTransportDocuments(publicTransportId),
    !!publicTransportId,
  );
}

export function useUploadPublicTransportDocument(tripId: string, publicTransportId: string) {
  return useUploadDocumentMutation(
    ['transfer-public-transport', publicTransportId, 'documents'],
    tripId,
    ({ passengerUserId, fileData, fileName, mimeType }) =>
      uploadPublicTransportDocument(tripId, publicTransportId, passengerUserId, fileData, fileName, mimeType),
  );
}

export function useDeletePublicTransportDocument(tripId: string, publicTransportId: string) {
  return useDeleteDocumentMutation(
    ['transfer-public-transport', publicTransportId, 'documents'],
    tripId,
    ({ documentId, storagePath }) => deletePublicTransportDocument(documentId, storagePath),
  );
}
