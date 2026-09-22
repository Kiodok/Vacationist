import { useMutationState } from '@tanstack/react-query';
import { isOptimisticId } from '../utils/optimisticId';

/**
 * True while the create of row `id` is still queued or in flight.
 *
 * Rows created offline carry a client-minted UUID (`createClientId`), which is indistinguishable from
 * a synced one — so "not on the server yet" can no longer be read off the id. The create mutation
 * itself is the source of truth: it stays `pending` (paused offline, running online) until it lands.
 * Legacy `__optimistic-` ids (queue entries from a pre-v1.39.0 build) count as pending too.
 */
export function useIsCreatePending(mutationKey: string, id: string): boolean {
  const pendingIds = useMutationState({
    filters: { mutationKey: [mutationKey], status: 'pending' },
    select: (m) => (m.state.variables as { id?: string } | undefined)?.id,
  });
  return isOptimisticId(id) || pendingIds.includes(id);
}
