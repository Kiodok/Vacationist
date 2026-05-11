import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTripMembers, removeTripMember, updateMemberRole, getCurrentMemberRole } from '@vacationist/api';
import type { MemberRole } from '@vacationist/types';
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
      addToast('success', 'Member removed');
    },
    onError: () => {
      addToast('error', 'Failed to remove member.');
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
