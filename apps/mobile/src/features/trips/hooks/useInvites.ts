import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getActiveInvites, createInviteToken, revokeInvite, redeemInviteToken } from '@vacationist/api';
import type { CreateInviteInput } from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';

export function useActiveInvites(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'invites'],
    queryFn: () => getActiveInvites(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useCreateInvite(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateInviteInput) => createInviteToken(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'invites'] });
    },
    onError: () => {
      addToast('error', 'Failed to create invite link.');
    },
  });
}

export function useRevokeInvite(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (tokenId: string) => revokeInvite(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'invites'] });
      addToast('success', 'Invite revoked');
    },
    onError: () => {
      addToast('error', 'Failed to revoke invite.');
    },
  });
}

export function useRedeemInvite() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (token: string) => redeemInviteToken(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      addToast('success', 'You joined the trip!');
    },
    onError: (error: Error) => {
      addToast('error', error.message || 'Failed to join trip.');
    },
  });
}
