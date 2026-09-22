import type { QueryClient } from '@tanstack/react-query';
import type {
  CreateShoppingItemVariables,
  CreateShoppingListVariables,
  UpdateShoppingItemVariables,
  UpdateShoppingItemGlobalVariables,
  DeleteShoppingItemVariables,
  CreateExpenseVariables,
} from '@vacationist/types';
import { OPTIMISTIC_ID_PREFIX } from './optimisticId';
import {
  addOptimisticShoppingList,
  addOptimisticShoppingItem,
  patchShoppingItem,
  removeShoppingItem,
} from '../features/shopping/utils/shoppingItemCache';
import { addOptimisticExpense } from '../features/expenses/utils/expenseCache';

/**
 * Re-applies the optimistic cache patches of queued offline mutations after a cold start.
 *
 * Why this exists: the offline mutation queue survives a kill (its own MMKV key), but the optimistic
 * rows it produced do not — `stripOptimisticRows` deliberately removes them from the query-cache
 * blob before it's written, and a mutation's `onMutate` lives in its feature hook, which doesn't
 * exist at boot. So after "add item offline → kill the app → relaunch still offline" the queue
 * counter said "1 change" while the item itself had vanished from every list.
 *
 * Each rehydrator reuses the SAME pure cache helpers as the hook's `onMutate`, so a queued change
 * looks identical whether the app stayed open or was restarted. They only ever patch a cache that is
 * already loaded, and every one is idempotent — running over a cache that already holds the change
 * (the blob was written after the mutation) is a no-op.
 *
 * Not restored: rollback context. If a replay ultimately fails, the reconnect `invalidateQueries()`
 * refetches and drops the row, and the mutation-cache subscriber (`queryClient.ts`) reports it.
 *
 * Only mutations whose absence is user-visible are registered. The rest still sync on reconnect;
 * they just aren't visible in the meantime after a restart (Phase 19 item D backlog).
 */

interface RehydrateContext {
  /** Deterministic per queued mutation, so re-applying never duplicates a placeholder row. */
  optimisticId: string;
  /** Current user id — '' when auth hasn't initialised yet (the row is replaced on replay anyway). */
  userId: string;
}

type Rehydrator = (qc: QueryClient, variables: unknown, ctx: RehydrateContext) => void;

const REHYDRATORS: Record<string, Rehydrator> = {
  // `id` is the client-minted UUID; only an entry persisted by a pre-v1.39.0 build lacks it, and then the
  // deterministic per-mutation id keeps the placeholder from being added twice.
  createShoppingList: (qc, v, ctx) => {
    const { tripId, input, id } = v as CreateShoppingListVariables;
    addOptimisticShoppingList(qc, { id: id ?? ctx.optimisticId, tripId, title: input.title, createdBy: ctx.userId });
  },
  createShoppingItem: (qc, v, ctx) => {
    const { listId, tripId, input, id } = v as CreateShoppingItemVariables;
    addOptimisticShoppingItem(qc, { optimisticId: id ?? ctx.optimisticId, listId, tripId, title: input.title, createdBy: ctx.userId });
  },
  updateShoppingItem: (qc, v) => {
    const { itemId, listId, tripId, input } = v as UpdateShoppingItemVariables;
    patchShoppingItem(qc, { itemId, listId, tripId, patch: input });
  },
  updateShoppingItemGlobal: (qc, v) => {
    const { itemId, tripId, input } = v as UpdateShoppingItemGlobalVariables;
    patchShoppingItem(qc, { itemId, tripId, patch: input });
  },
  deleteShoppingItem: (qc, v) => {
    const { itemId, listId, tripId } = v as DeleteShoppingItemVariables;
    removeShoppingItem(qc, { itemId, listId, tripId });
  },
  createExpense: (qc, v, ctx) => {
    const { tripId, input, id } = v as CreateExpenseVariables;
    addOptimisticExpense(qc, { optimisticId: id ?? ctx.optimisticId, tripId, input, createdBy: ctx.userId });
  },
};

/**
 * Re-apply the optimistic patch for ONE mutation (used when the user retries a change from the
 * "Couldn't sync" list). Unknown keys and malformed variables are ignored.
 */
export function reapplyOptimisticFor(qc: QueryClient, key: string, variables: unknown, userId: string): void {
  const rehydrate = REHYDRATORS[key];
  if (!rehydrate) return;
  try {
    rehydrate(qc, variables, { optimisticId: `${OPTIMISTIC_ID_PREFIX}retry-${Date.now()}`, userId });
  } catch {
    // Cosmetic only.
  }
}

/** The keys with a registered rehydrator — exported so a test can assert the registry stays in sync. */
export const OPTIMISTIC_REHYDRATOR_KEYS: readonly string[] = Object.keys(REHYDRATORS);

/**
 * Walks every still-pending mutation in the cache and re-applies its optimistic patch. Call once at
 * boot, AFTER the query cache has been restored and the mutation queue hydrated. Never throws: a
 * malformed persisted variable must not take the app down (or, worse, be mistaken for a corrupt
 * queue by the caller and wipe it). Returns how many mutations were re-applied.
 */
export function reapplyOptimisticRows(qc: QueryClient, getUserId: () => string): number {
  let applied = 0;
  let userId = '';
  try {
    userId = getUserId();
  } catch {
    // Auth not ready — placeholder rows just get an empty created_by.
  }

  for (const mutation of qc.getMutationCache().getAll()) {
    if (mutation.state.status !== 'pending') continue;
    const key = mutation.options.mutationKey?.[0];
    const rehydrate = typeof key === 'string' ? REHYDRATORS[key] : undefined;
    if (!rehydrate) continue;
    try {
      rehydrate(qc, mutation.state.variables, {
        // mutationId breaks a tie between two queued mutations persisted in the same millisecond.
        optimisticId: `${OPTIMISTIC_ID_PREFIX}rehydrated-${mutation.state.submittedAt}-${mutation.mutationId}`,
        userId,
      });
      applied++;
    } catch {
      // Skip this one; the mutation still replays on reconnect.
    }
  }
  return applied;
}
