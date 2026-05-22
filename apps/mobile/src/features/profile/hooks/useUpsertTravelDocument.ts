import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertTravelDocument } from '@vacationist/api';
import type { UpsertTravelDocumentInput } from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';

export function useUpsertTravelDocument() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: UpsertTravelDocumentInput) => upsertTravelDocument(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travelDocuments'] });
      addToast('success', 'Document saved');
    },
    onError: () => {
      addToast('error', 'Failed to save document.');
    },
  });
}
