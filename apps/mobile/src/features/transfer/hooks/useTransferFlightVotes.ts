import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransferFlightVotes,
  getTransferFlightVotesBatch,
  castTransferFlightVote,
  removeTransferFlightVote,
} from '@vacationist/api';
import type { VoteType, TransferFlightVote } from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useTransferFlightVotes(flightId: string) {
  return useQuery({
    queryKey: ['transfer-flights', flightId, 'votes'],
    queryFn: () => getTransferFlightVotes(flightId),
    retry: 2,
    enabled: !!flightId,
  });
}

export function useTransferFlightVotesBatch(flightIds: string[]) {
  const sortedIds = [...flightIds].sort();
  return useQuery({
    queryKey: ['transfer-flights', 'batch-votes', sortedIds],
    queryFn: () => getTransferFlightVotesBatch(sortedIds),
    retry: 2,
    enabled: sortedIds.length > 0,
  });
}

export function useCastTransferFlightVote(tripId: string, flightId: string) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (vote: VoteType) => castTransferFlightVote(flightId, vote),
    onMutate: async (vote) => {
      await queryClient.cancelQueries({ queryKey: ['transfer-flights', flightId, 'votes'] });
      const previous = queryClient.getQueryData<TransferFlightVote[]>(['transfer-flights', flightId, 'votes']);
      if (previous) {
        const exists = previous.findIndex((v) => v.user_id === currentUserId);
        const optimistic: TransferFlightVote[] =
          exists >= 0
            ? previous.map((v) => (v.user_id === currentUserId ? { ...v, vote } : v))
            : [
                ...previous,
                {
                  id: `optimistic-${Date.now()}`,
                  flight_id: flightId,
                  user_id: currentUserId!,
                  vote,
                  created_at: new Date().toISOString(),
                },
              ];
        queryClient.setQueryData(['transfer-flights', flightId, 'votes'], optimistic);
      }
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-flights', flightId, 'votes'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
    },
    onError: (_error, _vote, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['transfer-flights', flightId, 'votes'], context.previous);
      }
      addToast('error', 'Failed to cast vote.');
    },
  });
}

export function useRemoveTransferFlightVote(tripId: string, flightId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: () => removeTransferFlightVote(flightId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-flights', flightId, 'votes'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'transfer-flights'] });
    },
    onError: () => {
      addToast('error', 'Failed to remove vote.');
    },
  });
}
