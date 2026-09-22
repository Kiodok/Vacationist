---
name: offline-client-generated-ids
description: Use when adding or changing any offline-queued CREATE mutation (shopping list/item, expense, or any new `create*` in PERSISTED_MUTATION_KEYS), or debugging "item added offline disappears / can't add to an offline-created list / queued change vanished". Explains the client-generated UUID + scope model, and the reverted "Couldn't sync" UI (don't re-add it).
---

# Offline creates mint their own id

**Rule:** a create that can be queued offline takes a **client-generated UUID** in its mutation variables
(`id: createClientId()` from `apps/mobile/src/utils/optimisticId.ts`, passed by the call site), sends it as the
row's primary key, and uses it for the optimistic row. Done for `createShoppingList`, `createShoppingItem`,
`createExpense`. Optimistic row, persisted queue entry and server row share one identity — never re-keyed.

**Why:** with server-minted ids the optimistic row had a throwaway `__optimistic-…` id. An item added to a list
*created offline* referenced a list id the server had never seen and was dropped on replay (OFF4 in the
21.09.26 tester run — it blocked the whole offline test program). It also made cold-start rehydration guesswork.

**How to apply:**
- API: `insert({ id, … })` or RPC `p_id`. The insert must be **idempotent** — replay is at-least-once. Shopping
  helpers resolve a `23505` to the existing row; `create_expense_with_splits` returns the existing id for the same
  caller + trip (migration `20260921100000`, `DROP FUNCTION` the old overload first).
- Variables type (`packages/types`): `id?: string` (optional only so old queue entries still replay).
- `onMutate` and the rehydrator (`optimisticRehydrate.ts`) use `variables.id ?? createOptimisticId()`.
- "Is it still pending?" is NOT readable off the id any more → `useIsCreatePending(mutationKey, id)`.
- **Order dependent writes with a `scope`** in `mutationDefaults.ts` (`'shopping'`, `'expenses'` today). Per
  family, never one global scope — one hung request would block every queued write.
- Seed caches so the new row is visible: `addOptimisticShoppingList` seeds an empty items cache;
  `addOptimisticShoppingItem` seeds a list's cache when the list is known. Never fabricate All Items.
- A queued write that fails for good: `utils/queuedFailure.ts` refreshes the session and retries once for an
  auth error; anything else drops the mutation with the standard `common:offline.mutationFailed` toast — the
  same one every non-persisted mutation failure already uses. **Round 2 parked failed mutations in a
  `FAILED_MUTATIONS_v1` store + a Profile "Couldn't sync" management UI (Retry/Discard); this was reverted in
  round 3 (2026-09-22) — it confused users and Retry rarely helped, since the underlying rejection was still
  there. Do not re-add a user-facing failed-mutation list.** See [[offline-session-durability]] and
  [[offline-ux-patterns]].
