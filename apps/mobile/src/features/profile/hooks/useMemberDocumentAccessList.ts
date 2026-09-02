import { useQuery, useMutation } from '@tanstack/react-query';
import { getMemberDocumentAccessList, revealMemberDocuments } from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

/**
 * Organizer-only list of which members have granted document access and each grant's status
 * (not opened / expires in … / expired). Metadata only — no decrypted PII, so unlike the old
 * bulk RPC this is safe to poll and writes no audit-log rows. Tapping "View" on a row calls
 * useRevealMemberDocuments, which is what starts that member's countdown.
 */
export function useMemberDocumentAccessList(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ['memberDocumentAccessList', tripId],
    queryFn: () => getMemberDocumentAccessList(tripId),
    staleTime: 0,
    gcTime: 0,
    retry: 2,
    refetchInterval: 15_000,
    enabled: !!tripId && enabled,
  });
}

/**
 * Reveals one member's decrypted documents. The FIRST call for a member starts that grant's
 * 15/30/60-minute countdown. The result is sensitive — the caller must hold it in component
 * state only and drop it on unmount; this hook never caches it (useMutation, no setQueryData).
 */
export function useRevealMemberDocuments() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ tripId, memberUserId }: { tripId: string; memberUserId: string }) =>
      revealMemberDocuments(tripId, memberUserId),
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('profile:memberDocs.revealFailed'));
    },
  });
}
