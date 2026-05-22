import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteTravelDocument } from '@vacationist/api';
import { useToastStore } from '../../../stores/toastStore';

export function useDeleteTravelDocument() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (documentId: string) => deleteTravelDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travelDocuments'] });
      addToast('success', 'Document deleted');
    },
    onError: () => {
      addToast('error', 'Failed to delete document.');
    },
  });
}
