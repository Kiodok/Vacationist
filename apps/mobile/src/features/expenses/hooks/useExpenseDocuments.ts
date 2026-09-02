import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getExpenseDocuments, uploadExpenseDocument, deleteExpenseDocument } from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useExpenseDocuments(expenseId: string) {
  return useQuery({
    queryKey: ['expenses', expenseId, 'documents'],
    queryFn: () => getExpenseDocuments(expenseId),
    enabled: !!expenseId,
    retry: 2,
  });
}

// Deliberately not persisted (see PERSISTED_MUTATION_KEYS in mutationDefaults.ts) — replaying a
// stale file upload after an offline reconnect makes no sense, same reasoning as avatars/travel
// documents.
export function useUploadExpenseDocument(tripId: string, expenseId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ fileData, fileName, mimeType }: { fileData: Blob | ArrayBuffer; fileName: string; mimeType: string }) =>
      uploadExpenseDocument(tripId, expenseId, fileData, fileName, mimeType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'documents'] });
      addToast('success', i18n.t('expenses:toast.documentUploaded'));
    },
    onError: () => {
      addToast('error', i18n.t('expenses:toast.documentUploadFailed'));
    },
  });
}

export function useDeleteExpenseDocument(expenseId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ documentId, storagePath }: { documentId: string; storagePath: string }) =>
      deleteExpenseDocument(documentId, storagePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', expenseId, 'documents'] });
      addToast('success', i18n.t('expenses:toast.documentDeleted'));
    },
    onError: () => {
      addToast('error', i18n.t('expenses:toast.documentDeleteFailed'));
    },
  });
}
