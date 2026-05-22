import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyPendingAccessRequests,
  createDocumentAccessRequest,
  respondToDocumentAccessRequest,
  getMyActiveGrants,
  revokeDocumentAccess,
} from '@vacationist/api';
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
      addToast('success', 'Document access requested');
    },
    onError: (error: Error) => {
      addToast('error', error.message || 'Failed to create access request.');
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
      addToast('success', granted ? 'Access granted' : 'Access denied');
    },
    onError: () => {
      addToast('error', 'Failed to respond to request.');
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
      addToast('success', 'Access revoked');
    },
    onError: () => {
      addToast('error', 'Failed to revoke access');
    },
  });
}
