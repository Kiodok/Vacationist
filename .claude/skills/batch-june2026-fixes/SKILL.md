---
name: batch-june2026-fixes
description: Historical reference for the 21-item bug-fix/enhancement session completed June 2026 (translations, date validation, notification i18n, deep linking, settlements, overnight activity logic). Use to avoid re-introducing already-fixed patterns when touching these areas.
---

# June 2026 batch: 21-item fix session

June 2026 batch of 21 fixes across the Vacationist app, done as a quality pass before a minor release.

**Why:** Quality pass addressing user-reported issues across all major features.

**How to apply:** Reference for what changed so future work doesn't re-introduce these patterns.

## Changes made

### Translations (Group A)
- Added i18n keys for vote button, vote options (VoteChip), status badges (StatusIndicator), activity categories (CreateActivitySheet/EditActivitySheet/ActivityCard), shopping list card progress, recipe servings/ingredients.
- Fixed: FlightCard, VehicleCard, FlightStatusIndicator hardcoded English strings → `useTranslation`.
- New keys in: en/de `activities.json`, `shopping.json`, `recipes.json`, `transfer.json`.

### UI/UX (Group B)
- **Toast positioning**: raised 72px above FAB zone (`Toast.tsx` bottom: `max(insets.bottom, 84)px`).
- **Custom packing categories**: `PrivatePackingListView` computes `usedCustomCategories` and passes to `CreatePackingItemSheet` as dashed-border pills.
- **Settlements layout**: `SettlementsModal` member rows now stack "Paid/Owes" below name instead of a single line.
- **Lost/Found stale closure fix**: type selection `onPress` now computes `newNeedsTarget` from the new type directly.
- **Lost/Found form reset**: `CreateLostFoundCaseSheet` `useEffect` resets on visible→false.
- **Notes padding**: `paddingBottom` 80→100 so the last item's checkbox isn't hidden by the FAB.
- **Expenses "Open" removed**: removed `summary.open` total from the expenses tab header.

### Date validation (Group C)
- Flights (Create/Edit) and Rentals (Create/Edit) now accept `tripStartDate`/`tripEndDate` props.
- `minimumDate`/`maximumDate` wired on departure/pickup date pickers.
- Dropoff constrained to pickupDate as minimum.
- Parent `transfer.tsx` passes `trip.start_date`/`trip.end_date` to all four sheets.

### Business logic (Group D)
- **Overnight activities**: `isAutoCompleted`/`isOngoing` now detect `end_time < start_time` and add 1 day to end.
- **Settlement invalidation**: `useSettleAllForPair` now invalidates `['trips', tripId, 'expenses']` and `['trips', tripId, 'balances']` on success + shows a success toast.

### Notification i18n (Group E)
- **Migration `20260608200000`**: added `context_entity`, `context_trip`, `context_creator` columns to `notifications`; updated all trigger functions and the `create_trip_notification` helper to populate these.
- **Edge function**: `NOTIFICATION_TRANSLATIONS` now uses `{{entity}}`/`{{trip}}`/`{{creator}}` template bodies; `translateNotification` interpolates context; the `'reminder'` type still prefers the DB body (nudges are pre-translated client-side).
- **Nudge trip name**: `NudgeSheet` accepts a `tripName` prop; all 8 nudge body templates include `{{tripName}}`.
- **Deep linking**: `usePushNotificationHandler` uses `useLastNotificationResponse` for cold-start; `resolveNotificationPath` appends a `highlightId` param; tabs (activities, expenses, notes, stuff, transfer) read `highlightId` and scroll to + highlight the matching item; `highlight` prop added to `ExpenseCard`, `NoteCard`, `LostFoundCaseCard`; `ActivityCard` refactored to use a shared `useHighlightAnimation` hook.

### Settlement tests (Group F)
- `packages/utils/src/settlements.test.ts`: added 20+ new tests (4/5-person scenarios, edge cases, invariants).
- New file: `packages/utils/src/settlements-scenarios.test.ts` — 6 end-to-end multi-expense scenarios.
- All 70 tests pass.

### DB/infra
- Migration `20260608200000_notification_i18n_context.sql` applied to both dev (`aejywkbkcwyanhyzhrle`) and prod (`fsfsqghbejwvgxujoyne`).
- `push-notification` edge function redeployed to both environments.

See also [[notification-i18n-debt]] for the known trade-off this batch shipped with (English-only push bodies), and [[offline-ux-patterns]] which was a separate, related overhaul.
