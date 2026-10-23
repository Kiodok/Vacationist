---
name: sheet-discard-guard
description: Use before creating or editing any sheet that collects a discardable draft (a Create/Edit form, a multi-select with its own Confirm button) — every input-collecting sheet in the app must resist accidental closing via useDiscardGuard() + <DiscardConfirmBar>, not a hand-rolled copy of the pattern.
---

v1.39.6 built an inline "Discard changes?" confirm for exactly two sheets —
`CreateExpenseSheet.tsx`/`EditExpenseSheet.tsx` — because those were the only two it was reported
against. v1.39.8 extracted that hand-rolled pattern into shared primitives and rolled it out to
every other input-collecting sheet (34 sheets + `PassengerSelectSheet`), per an explicit Tech Lead
ask to secure "all drawers" the same way Expenses already was.

**Why:** copying the Expense sheets' ~25 lines into 35 more files would have been unmaintainable
and would drift the moment one copy got a fix the others didn't (exactly what happened once
already — `dismissGuard`/`onDismissBlocked` had to be patched onto two files by hand in v1.39.6's
manual-QA follow-up). One hook + one component now owns the whole pattern.

**How to apply — any new sheet with a discardable draft:**

```tsx
const hasUnsavedInput = isDirty || priceText !== initialPriceText;   // RHF isDirty + any non-Controller text mirror
const { requestClose, swipeProps, discardConfirmVisible, confirmDiscard, cancelDiscard } =
  useDiscardGuard({ visible, hasUnsavedInput, onClose: handleClose });   // handleClose = the sheet's LOCAL close

<Modal visible={visible} transparent animationType="slide" onRequestClose={requestClose}>
  <SwipeToDismiss {...swipeProps} className="…" style={…}>
    <grabber />
    {discardConfirmVisible ? (
      <DiscardConfirmBar onCancel={cancelDiscard} onDiscard={confirmDiscard} />
    ) : (
      <>{/* header Cancel -> onPress={requestClose}; body unchanged */}</>
    )}
  </SwipeToDismiss>
</Modal>
```

- `useDiscardGuard()` — `apps/mobile/src/hooks/useDiscardGuard.ts`. Owns the confirm-visible
  state, the `requestClose` router (shows the confirm when dirty, else closes immediately), and
  the `useSharedValue` mirror of `hasUnsavedInput` that `SwipeToDismiss`'s gesture worklet reads
  synchronously on the UI thread — see [[swipetodismiss-ondismiss-may-not-dismiss]] for why that
  mirror can't be replaced with plain React state (the slide-away animation commits before
  `onDismiss` runs).
- `<DiscardConfirmBar>` — `apps/mobile/src/components/DiscardConfirmBar.tsx`. The inline bar.
  Reads generic copy from `common.confirm.discardChanges`/`discardYes` unless given a `message`
  override (the two Expense sheets keep their own expense-specific wording this way).
- `sameMembers()` — `apps/mobile/src/utils/sheetDirty.ts`. Order-independent Set/array equality,
  for a sheet whose draft is a selection rather than form fields (`PassengerSelectSheet`:
  `!sameMembers(selected, selectedUserIds)`, excluding any toggle that fires an immediate mutation
  rather than being part of the draft).
- **`requestClose` is the ONE handler for all three close surfaces** — `Modal.onRequestClose`
  (Android back button), the header Cancel/X `Pressable`, and (via `swipeProps`) the swipe-down
  gesture + backdrop tap inside `<SwipeToDismiss>`. Never let any of the three call the raw
  `onClose` prop or a bare `handleClose` directly once a sheet has this guard.
- **What counts as unsaved input:** `formState.isDirty` covers RHF Controller fields. OR in any
  local-state text mirror outside a Controller (`priceText`, `costText`, `quantityText`, staged
  files) compared to its initial value — for an Edit sheet, capture that `initial*` snapshot
  inside the same effect that prefills the field (`EditExpenseSheet.tsx`'s `initialTipText` is the
  precedent). Exclude purely presentational state (picker-visible flags, a delete-confirm toggle)
  — a UI mode flipped without typing anything isn't lost work. A non-RHF sheet (plain `useState`
  form, e.g. `CreateTopicSheet`/`EditTopicSheet`) hand-rolls the comparison against each field's
  empty/initial value instead of `isDirty`.
- **Not every sheet needs this.** Instant-commit pickers (`OptionPickerSheet`,
  `CurrencyPickerSheet`, `CalendarPickerSheet`, `VoteSheet` — a tap already applies the result) and
  view-only/action-list sheets (`InfoSheet`, `ViewNoteSheet`, `MessageActionsSheet`,
  `MemberDocumentsSheet`, `CalendarActivitySheet`, `SettlementsModal`,
  `SettlementReceiptDetail`) have nothing to lose on close — leave them as plain
  `<SwipeToDismiss onDismiss={onClose}>`, no guard.
- **A real bug class to watch for on any `Edit*` sheet you touch:** passing the raw `onClose` prop
  straight into `Modal.onRequestClose`/`SwipeToDismiss.onDismiss`/the header Cancel button with no
  local close handler at all. v1.39.8 found and fixed ~10 sheets still doing this (the exact thing
  already fixed once for `EditExpenseSheet` in v1.39.6) — it's worth a routine check, not an
  isolated incident.
- **`GuestUpgradeSheet` is a confirmed non-guard, not an open question** — Tech Lead's explicit
  call when asked. It has real work to lose (typed email + an in-flight captcha), but a "Discard
  changes?" bar reads oddly in an auth flow. Stays exactly as it is; don't add this guard OR a
  narrower "can't dismiss while verifying" variant to it without a new, separate ask.

See [[sheet-swipe-to-dismiss]] for the base `<SwipeToDismiss>`/`<SheetScrollArea>` contract every
sheet follows regardless of whether it needs this guard.
