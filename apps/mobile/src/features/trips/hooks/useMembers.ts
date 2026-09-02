import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTripMembers, removeTripMember, leaveTrip, updateMemberRole, getCurrentMemberRole } from '@vacationist/api';
import type { MemberRole } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useTripMembers(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'members'],
    queryFn: () => getTripMembers(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useCurrentMemberRole(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'role'],
    queryFn: () => getCurrentMemberRole(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useRemoveMember(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (userId: string) => removeTripMember(tripId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      addToast('success', i18n.t('trips:toast.memberRemoved'));
    },
    onError: (error: Error) => {
      if (__DEV__) console.error('[useRemoveMember] error:', error.message);
      addToast('error', error.message || i18n.t('trips:toast.removeMemberFailed'));
    },
  });
}

export function useLeaveTrip(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: () => leaveTrip(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      addToast('success', i18n.t('trips:toast.left'));
    },
    onError: () => {
      addToast('error', i18n.t('trips:toast.leaveFailed'));
    },
  });
}

export function useUpdateMemberRole(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MemberRole }) =>
      updateMemberRole(tripId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'members'] });
      addToast('success', 'Role updated');
    },
    onError: () => {
      addToast('error', 'Failed to update role.');
    },
  });
}
