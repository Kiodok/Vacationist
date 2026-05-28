import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteTravelDocument } from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useDeleteTravelDocument() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (documentId: string) => deleteTravelDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travelDocuments'] });
      addToast('success', i18n.t('profile:toast.docDeleted'));
    },
    onError: () => {
      addToast('error', i18n.t('profile:toast.docDeleteFailed'));
    },
  });
}
