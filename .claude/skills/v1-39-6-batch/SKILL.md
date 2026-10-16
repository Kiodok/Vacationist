---
name: v1-39-6-batch
description: Use to answer "what's in v1.39.6" / "status of v1.39.6", or before touching transfer_documents / flight ticket uploads, isExpenseFullySettled / ExpenseCard's settled badge, CreateExpenseSheet / EditExpenseSheet's close handling, the mutation retry logic in queryClient.ts or errorClassification.ts, or expenses.created_at.
---

Six Tech-Lead-reported items, all code-complete as of 2026-10-14, **not committed**. A 2026-10-15
prod incident (see point 6 and [[migration-create-or-replace-overload-trap]]) reverted items 1 and
6's migrations — read those two points carefully before touching either area again. The Tech
Lead's own manual QA pass on 2026-10-16 then found and got fixed two more bugs, in points 4 and 5
below — read those too before touching `SwipeToDismiss.tsx` or `errorClassification.ts`.

**Why:** real-usage reports from the Tech Lead after v1.39.5 shipped — round-trip ticket uploads,
sheet scroll/dismiss UX, a settlement-status edge case, and an offline-sync reliability gap.

**How to apply:**

1. **Round-trip flight ticket legs** — `transfer_documents.leg` (`'outbound' | 'return'`, default
   `'outbound'`), unique key `(flight_id, user_id, leg)`. Migration
   `20261014110000_transfer_document_leg.sql` is **DEV ONLY again** — it reached prod briefly on
   2026-10-15 as a side effect of `supabase db push` sweeping in all pending migrations while
   fixing the point-6 incident, and was reverted there the same session
   (`20261015110000_revert_transfer_document_leg_prod_only.sql`, prod-only — dev's ledger marked
   `applied` via `migration repair` without re-running it, so dev still has the feature). It changes
   the client's `upsert(..., onConflict:)` target, so pushing it to prod ahead of the matching
   client commit breaks every flight-ticket upload on prod — proven, not just theorized, now. It
   must land on prod in the exact same push as the client commit that updates
   `transferDocuments.ts`'s `onConflict: 'flight_id,user_id,leg'`. **Before ever pushing it to prod
   again: regenerate `database.types.ts` and confirm `transfer_documents` shows `leg` AND no RPC
   near it shows a duplicate `Args` union** (see point 6). `buildTransferTicketPath`'s `leg` param
   defaults to `'outbound'` and only suffixes the path for `'return'`, so every pre-existing
   ticket's storage object is untouched.
2. **Sheet scrolling** — a sheet's full-body `RichText` must be non-selectable (`selectable` false
   or omitted) whenever it sits inside a `SheetScrollArea`, or it competes with the scroll gesture
   for the initial touch and can let swipe-to-dismiss win over scrolling — see `VehicleCard.tsx`'s
   `selectable={notesExpanded}` for the established workaround pattern. Only applies inside an
   actual `SwipeToDismiss` sheet; a plain screen ScrollView has no competing gesture.
3. **`isExpenseFullySettled`** (`packages/utils/src/settlements.ts`) now returns `true` for a
   self-only expense (payer's lone split, zero non-payer splits) — do not reintroduce the
   `nonPayer.length > 0` guard; that was the bug. `hasAnySettledSplit` (the edit-lock predicate)
   is intentionally unchanged.
4. **Expense sheet close handling** — `CreateExpenseSheet.tsx`/`EditExpenseSheet.tsx` gate their
   close handler (used by `SwipeToDismiss`'s `onDismiss`, the backdrop tap, and the header close
   button alike) behind a "Discard changes?" inline confirm when the form is dirty. Any future
   change to these sheets' close flow must preserve that gate, not bypass it by calling `onClose`
   directly again.
   **Manual-QA follow-up (2026-10-16):** swiping down a dirty form originally left the app looking
   stuck — see [[swipetodismiss-ondismiss-may-not-dismiss]]. `SwipeToDismiss.tsx` now has an
   optional `dismissGuard`/`onDismissBlocked` pair (both sheets pass a `useSharedValue` mirror of
   `hasUnsavedInput`) so a blocked dismiss bounces back instead of sliding off-screen first and
   discovering it shouldn't have. No other sheet is affected — both props default to "never block."
5. **Mutation retry / offline hardening** — `errorClassification.ts`'s `isNetworkError()` is
   deliberately narrow: a bare `TypeError` is NOT sufficient on its own (a real null-reference bug
   is also a TypeError), only a recognized network-failure message fragment or `AbortError`
   qualifies. `queryClient.ts`'s `mutationRetry` flips `onlineManager.setOnline(false)` the moment
   it classifies a failure as network-shaped — this is what actually pauses/persists the mutation
   (via TanStack's own `canFetch` check on the next attempt), not merely a bigger retry count. Any
   new persisted mutation's `onError` that rolls back optimistic state should check
   `isNetworkError(err)` first and skip the rollback in that case, same as `useCreateExpense`.
   **Manual-QA follow-up (2026-10-16):** airplane mode still showed an instant failure toast — see
   [[network-error-classification-shape-gate]]. `isNetworkError` no longer gates on
   `looksLikePostgresError` (key-presence only); it checks for a **non-empty** `code` directly,
   since postgrest-js wraps a genuine fetch failure into `{message, details, hint, code: ''}` —
   every key present, `code` just empty — which defeated the old gate.
6. **`expenses.created_at` — REVERTED, do not re-enable without reading this.**
   `20261014100000_expense_created_at_editable.sql` added `p_created_at` to all three
   expense-writing RPCs via `CREATE OR REPLACE FUNCTION`. That technique does **not** replace a
   function when its argument types change — it silently creates a second overload — which broke
   expense create/edit on prod for about a day with **zero visible diagnostics** (no Postgres
   error, no Sentry capture, no console output, no network error — PostgREST rejects the ambiguous
   call before it ever reaches Postgres, and `isExpectedMutationError` already treats any `PGRST*`
   code as "expected"). Full story: [[migration-create-or-replace-overload-trap]].
   **Current state: live on BOTH dev and prod, correctly this time.** First reverted everywhere
   (`20261015100000_revert_expense_created_at_overloads.sql`), then re-added — first dev-only via
   `20261015120000_expense_created_at_editable_dev_redo.sql` (explicit `DROP FUNCTION` of each old
   signature before `CREATE FUNCTION` of the new one, in the same migration, instead of relying on
   `CREATE OR REPLACE` alone), then **pushed to prod too on 2026-10-16**, ahead of the client
   release, at the Tech Lead's explicit request after confirming it's safe: single overload means a
   still-live v1.39.5 client simply omits `p_created_at`, which defaults via `COALESCE` exactly as
   before — no ambiguity. (Unlike the round-trip-ticket-legs migration below, which genuinely cannot
   tolerate this and must wait for the client.) Verified via regenerated `database.types.ts` from
   **both** environments: single `Args` object (with `p_created_at?`) on each, no union, and prod
   correctly still has no `leg` column. **This item needs no further migration work** — the
   working-tree client code (date/time field in Create/Edit sheets, Zod schema, API-layer params)
   will work correctly once committed/shipped. Floating-wall-clock design (`YYYY-MM-DDTHH:mm`, no
   timezone conversion — see [[floating-wall-clock-times]]) is unchanged and correct.
   **Note on checking "what's pending":** `supabase migration list` is an execution log, not a
   current-schema tracker — `20261014110000` (round-trip legs) still shows "applied" on prod even
   though a later migration reverted its effects, so it will never show as pending again. Always
   verify actual current schema state via regenerated `database.types.ts`, not the migration list —
   see [[migration-create-or-replace-overload-trap]].

**Not done:** no browser verification (no Chrome session this session), no live rolled-back-`DO`-
block SQL verification (no Docker, no SQL-execution tool available) — correctness rested on
verbatim-copy + narrow-diff review and a regenerated-types scope check, which is exactly what
caught the point-6 incident, but only *after* it was already live on prod. **Do the union-shape
check before the first prod push of any signature-changing migration, not just when debugging
afterward.** See [[project_v1_39_6_batch]] for full detail.
