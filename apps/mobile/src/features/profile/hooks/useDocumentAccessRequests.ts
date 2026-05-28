import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyPendingAccessRequests,
  createDocumentAccessRequest,
  respondToDocumentAccessRequest,
  getMyActiveGrants,
  revokeDocumentAccess,
} from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function usePendingAccessRequests() {
  return useQuery({
    queryKey: ['pendingAccessRequests'],
    queryFn: getMyPendingAccessRequests,
    retry: 2,
    refetchInterval: 30_000,
  });
}

export function useCreateDocumentAccessRequest() {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({
      tripId,
      durationMinutes,
    }: {
      tripId: string;
      durationMinutes: number;
    }) => createDocumentAccessRequest(tripId, durationMinutes),
    onSuccess: () => {
      addToast('success', i18n.t('profile:toast.accessRequested'));
    },
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('profile:toast.accessRequestFailed'));
    },
  });
}

export function useRespondToAccessRequest() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({
      requestId,
      granted,
    }: {
      requestId: string;
      granted: boolean;
    }) => respondToDocumentAccessRequest(requestId, granted),
    onSuccess: (_data, { granted }) => {
      queryClient.invalidateQueries({ queryKey: ['pendingAccessRequests'] });
      if (granted) queryClient.invalidateQueries({ queryKey: ['activeGrants'] });
      addToast('success', granted ? i18n.t('profile:toast.accessGranted') : i18n.t('profile:toast.accessDenied'));
    },
    onError: () => {
      addToast('error', i18n.t('profile:toast.accessRespondFailed'));
    },
  });
}

export function useActiveGrants() {
  return useQuery({
    queryKey: ['activeGrants'],
    queryFn: getMyActiveGrants,
    refetchInterval: 60_000,
  });
}

export function useRevokeDocumentAccess() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (requestId: string) => revokeDocumentAccess(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeGrants'] });
      addToast('success', i18n.t('profile:toast.accessRevoked'));
    },
    onError: () => {
      addToast('error', i18n.t('profile:toast.accessRevokeFailed'));
    },
  });
}
