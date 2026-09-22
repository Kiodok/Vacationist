import type { QueryClient, Mutation } from '@tanstack/react-query';
import { refreshSessionQuietly } from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../stores/toastStore';
import { isAuthError } from './errorClassification';

/**
 * What happens to a change that was queued offline and then failed for good on replay.
 *
 * A session/token rejection (the JWT lapsed during a long offline stretch) is NOT a verdict on the
 * change — refresh the session and send it once more, silently. This is the one genuine improvement
 * from the original "never drop the user's data" design (OFF-8): a merely-expired-session sync now
 * quietly succeeds with no user awareness needed.
 *
 * Anything else (a business rule, a permission change, a deleted parent) is dropped with the same
 * generic toast every non-persisted mutation failure already uses — a "Couldn't sync" management
 * list was tried in v1.39.0 round 2 and reverted the same round: it confused users, Retry rarely
 * helped (the underlying rule rejection was still there), and the raw server error text wasn't
 * meaningful to a non-developer (device-test finding, 22.09 test session). Don't reintroduce it.
 *
 * Deliberately takes the QueryClient as a parameter instead of importing it: `queryClient.ts` calls
 * into this module from its mutation-cache subscriber, and a back-import would be circular.
 */

/** Run a mutation from scratch — same defaults (mutationFn, onSuccess, scope) as the original. */
async function executeFresh(qc: QueryClient, key: string, variables: unknown): Promise<void> {
  const mutation = qc.getMutationCache().build(qc, { mutationKey: [key] });
  await mutation.execute(variables);
}

/**
 * Call once per queued mutation that ended in `error`. Fire-and-forget; never throws.
 */
export async function handleQueuedFailure(qc: QueryClient, mutation: Mutation<unknown, unknown, unknown, unknown>): Promise<void> {
  const key = mutation.options.mutationKey?.[0];
  if (typeof key !== 'string') return;
  const variables = mutation.state.variables;
  const error: unknown = mutation.state.error;

  try {
    if (isAuthError(error)) {
      await refreshSessionQuietly();
      try {
        await executeFresh(qc, key, variables);
        return;
      } catch {
        // Fall through to the generic toast below — the retry itself failed too.
      }
    }
    useToastStore.getState().addToast('warning', i18n.t('common:offline.mutationFailed'));
    // The optimistic row the queued change produced is now a phantom — a refetch drops it.
    void qc.invalidateQueries();
  } catch {
    // Must never throw into the mutation cache's subscriber.
  }
}
