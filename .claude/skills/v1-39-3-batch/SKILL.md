---
name: v1-39-3-batch
description: Use to answer "what's in v1.39.3" / status of v1.39.3, or before touching the Activities/Accommodations/Transfers booking-link TouchableOpacity rows, TicketsSection.tsx, ActivityDocumentsSection, activities.documents_enabled, PassengerSelectSheet.tsx, apps/mobile/src/components/SegmentedControl.tsx, or the vehicle direction i18n keys in transfer.json.
---

# v1.39.3 batch

Three items from a 2026-10-03 `/plan` request, all code-complete, migration + edge function
deployed dev + prod same session, client **not committed** (pending Tech Lead testing).

## 1. Link tap-targets fixed (no migration)
**Root cause:** a `TouchableOpacity` (icon+text, `flex-row items-center gap-xs`) placed as a
direct child of a column-flex container inherits RN's default `alignItems: 'stretch'` — it
stretches to the container's full width, so the hit-box covers the whole row, not just the visible
link text. Where that `TouchableOpacity` sat inside a card's own outer navigate-`Pressable`
(AccommodationCard, RentalCard, PublicTransportCard), this also stole the whole-card tap.

**Fix:** `self-start` (NativeWind className) / `alignSelf: 'flex-start'` (inline style) on each —
content-sized, not stretched. Same idiom already used elsewhere (`ExpenseDocumentsSection.tsx`,
`StagedDocumentsField.tsx`). Fixed in 6 files: `activities.tsx` + `accommodations.tsx` detail
panels, `transfer.tsx` flight detail, `AccommodationCard.tsx` (both links), `RentalCard.tsx`,
`PublicTransportCard.tsx`. **Not touched** (already content-sized, row-wrap parent, not a
stretch context): `ActivityCard.tsx`'s own `maps_url`.

## 2. Per-person activity document uploads (new switch + migration)
New `activities.documents_enabled` boolean (default `false`), toggled via a `Switch` in
Create/EditActivitySheet right below `reservation_required` (same `Controller` pattern). When
true, the activity's expanded detail panel renders `ActivityDocumentsSection` — every trip member
gets an upload/replace/delete row, same UX as Transfers' flight/PT tickets.

**Reused, not duplicated, `TicketsSection.tsx`** (the shared per-member document-row list): it
gained a `TDoc extends DocumentLike` generic (structural subset: id/user_id/storage_path/
mime_type), an optional `namespace?: 'transfer' | 'activities'` prop (literal union, not `string`
— `useTranslation` rejects a bare string), and a `getDocumentUrl` prop (bucket-specific signed-URL
minting — `transfer-documents` vs. the new `activity-documents` bucket are different buckets).
`FlightTicketsSection`/`PublicTransportTicketsSection` now pass `getDocumentUrl={getTransferDocumentUrl}`
explicitly (previously hardcoded inside the shared component).

**New i18n keys reuse the exact key NAMES `TicketsSection.tsx` already looks up** (`field.ticket`,
`action.addTicket`, `confirm.deleteDocument`, `toast.document*`, etc.) in the new `activities`
namespace, just worded "document" instead of "ticket" — a quirk, not a bug: it keeps the shared
component's code unchanged across both namespaces.

**Migration `20261003150000_activity_documents_and_toggle.sql`:** additive `documents_enabled`
column; `create_activity` RPC DROP+CREATE with a new trailing optional `p_documents_enabled` param
(same dance as every prior addition to this RPC — backwards-compatible since `.rpc()` calls are
named-JSON, not positional); new `activity_documents` table (own table, not grafted onto
`transfer_documents` — distinct parent entity) + `activity-documents` Storage bucket, RLS/trigger
shape copied verbatim from `transfer_documents`; `delete_own_account()` gained a reassignment block
for the new non-cascading `user_id`/`uploaded_by` FKs (CLAUDE.md's Account Deletion rule).
**Deployed dev + prod same session**, evaluated as safe (additive, backwards-compatible) with no
Tech Lead hand-off needed this time — unlike the `/prod-deploy-classifier-blocks-file-prep`
blocks hit twice during v1.39.2.

`create-example-trip` edge function updated (and redeployed dev+prod) to set
`documents_enabled: true` + `reservation_required: true` on the demo "Sagrada Família" activity —
no `activity_documents` row seeded (same deliberate omission as expense/transfer documents: a
metadata row with no real file 404s on signed-URL fetch).

## 3. Vehicle direction labels fixed (no migration)
`direction.outbound/return/both` in `transfer.json` were shared verbatim between flights AND
vehicles — DE values are flight-specific ("Hinflug"/"Rückflug"/"Hin- und Rückflug"), wrong for
vehicles (EN "Outbound"/"Return"/"Both" happens to read fine either way, which is why this was
never caught in English). Added vehicle-only `vehicle.direction.{outbound,return,both}` keys
("Hinfahrt"/"Rückfahrt"/"Hin- und Rückfahrt"), left `direction.*` untouched for flights. Repointed
every vehicle-only call site (`VehicleCard.tsx`, `CreateVehicleSheet.tsx`, `EditVehicleSheet.tsx`,
`transfer.tsx`'s `vehicleSections`) and gave `AllTransfersView.tsx`'s shared `DirectionBadge` a
`kind: 'flight' | 'vehicle'` prop so the one shared component picks the right key prefix.

## Also fixed mid-session (pre-existing, unrelated)
Same drift bug flagged in the v1.39.2 entry recurred: `marketing/site/build.mjs`'s `APP_VERSION`
constant was still `'1.39.2'` against `app.config.ts`'s already-bumped `'1.39.3'`. Fixed +
`npm run build:site` re-run, before this session's own migration work even began.

## 4. Driver switch deselecting the passenger (same-day follow-up `/plan`, separate from the 3
items above — no migration)
**Reported bug:** in the vehicle passenger-select sheet, tapping a selected member's "Driver"
switch also unchecked them as a passenger (and the switch itself then vanished, since it only
renders while selected).

**Root cause:** `PassengerSelectSheet.tsx`'s `renderItem` had the `Switch` nested INSIDE the row's
own `Pressable` (`onPress={() => toggle(member.user_id)}`) — a tap on the switch also fired the
row's `onPress` (web: literal DOM click-bubbling through `Switch`'s underlying `<input>`). This
codebase already hit this exact bug class and rejected the obvious wrong fix:
`DateTimePickerField.tsx:320-336`'s comment explains `onStartShouldSetResponder={() => true}` to
"swallow" a nested touch was tried and reverted (it makes JS claim touches meant for a native
control). The correct, already-established fix is structural: make the two controls **siblings**,
never nested.

**Fix:** the row is now a plain `View`; the checkbox+name became their own `flex-1` `Pressable`
(still fills all space left of the driver toggle, same tap-target size as before), and the Driver
label+`Switch` sit as a sibling after it — fully touch-isolated, nothing to bubble into.

**Also fixed while here (found diagnosing, not reported):** the driver switch was reachable for a
member who was only *locally* checked, not yet a real `transfer_vehicle_passengers` row — tapping
it there was a guaranteed `PGRST116` failure (`updateTransferVehiclePassenger`'s `.update(...).
single()` has no row to match). Added `&& selectedUserIds.includes(member.user_id)` to the
visibility guard — `selectedUserIds` is the live server-backed prop, so the switch now appears
only once the passenger is actually persisted.

**Explicitly not fixed (flagged only):** `useUpdateTransferVehiclePassenger` has no optimistic
update, so the switch can visually snap back for a moment until refetch — true of every passenger
mutation in that hooks file (add/remove too), so left as a pre-existing, consistent gap rather than
fixed in isolation here.

**File:** `apps/mobile/src/features/transfer/components/PassengerSelectSheet.tsx` only — shared by
flights/vehicles/PT, but only the vehicle call site passes `showDriverToggle`. No migration, no
type changes. Browser-verified live (Chrome, `npm run web`, the "Test" dev trip, organizer
account): toggled Julia's driver flag on `Chally` — she stayed checked, the switch stayed visible,
`is_driver` persisted (car icon appeared on her passenger chip after closing the sheet); reverted
the toggle back off afterward to leave the trip's data as found.

## 5. `/code-review` follow-up — 3 findings, all confirmed and fixed

1. **`activity_documents` missing a BEFORE UPDATE trip_id trigger** (real RLS gap — same class
   already found/fixed for `transfer_documents` by `20260901110002`). The INSERT-only trigger from
   `20261003150000` means `uploadActivityDocument`'s upsert-replace path (ON CONFLICT → UPDATE)
   never re-derives `trip_id`, letting a document's own owner spoof which trip it's attributed to.
   Fixed with a new migration (can't edit the already-deployed one):
   `20261003160000_activity_documents_trip_id_on_update.sql` — deployed dev + prod same session.
2. **URL truncation regression from item 1's own tap-target fix.** `self-start`/`alignSelf:
   'flex-start'` removed the accidental width-bound that used to let `numberOfLines={1}` actually
   ellipsize a long external_url/maps_url — without it, long URLs now render un-truncated and can
   overflow the card. Fixed in the same 6 files with `max-w-full` (row) + `shrink` (Text) —
   re-caps the row at the parent's width while letting the Text actually shrink to fit.
   `AccommodationCard.tsx` was correctly NOT touched (shows a fixed short label, not the raw URL).
   Verified via direct DOM inspection + an ancestor-width constraint experiment in Chrome
   (confirmed `scrollWidth > clientWidth` + ellipsis only engages once the available width is
   actually narrower than the content — a flat screenshot at desktop width is not a reliable test
   for this class of bug, since the string can just happen to fit).
3. **Account-deletion disclosure pages (EN+DE) never updated for the new `activity_documents`
   table** — a direct CLAUDE.md Account Deletion rule miss from the original v1.39.3 pass. Fixed:
   `docs/delete-account.html`, `docs/privacy-policy.html`, and their DE markdown sources now
   mention activity documents alongside expense receipts/transfer tickets; site rebuilt.

No new migration risk beyond item 1 (additive trigger only). `npm run typecheck` / `npm test`
green throughout (510 tests, unchanged — JSX/migration/docs-only round).

## 6. Segmented-control pills collapse to zero height on web (shared component, not Transfer-only)

Third same-day `/plan` request. Reported: Transfer's pill bar (All/Flights/Vehicles/Rentals/
Public Transport) renders with invisible/clipped labels on web, "not enough height" vs. Shopping/
Stuff's pill bars; looked fixed after clicking a pill, broken again after navigating away and back.

**Root cause, confirmed live via direct DOM measurement (not guessed):** `SegmentedControl.tsx`
(the ONE shared component behind Transfer/Shopping/Stuff/Prework's pill bars) had
`contentContainerClassName="flex-row gap-xs px-md pt-sm pb-xs"` with **no `items-center`** —
RN's default `align-items: stretch` on that row, combined with every pill also being an
auto-height column box, creates a circular cross-axis sizing computation that React Native Web can
resolve to a degenerate ~0px for every pill's label on a fresh mount. Confirmed via
`scrollHeight` (correct, 18px) vs. `offsetHeight`/rendered box (0px) — a genuine layout collapse,
not a text-measurement or data bug. Explicit `height`, forced reflows (removeChild/reinsert),
and window resize do NOT fix it — only a prop-driven re-render that happens to resolve
`align-items` differently does, which is the real explanation for "fixed after clicking."

**Not Transfer-specific** — reproduced the identical collapse on Shopping's pill bar too on a cold
mount (its "Lists"/"All Items"/"Recipes" rendered as bare "...", "..", "." dots before the fix).
Transfer is just the most visibly broken (5 segments) and most frequently revisited.

**Fix:** one line — added `items-center` to that `contentContainerClassName`. Matches the
near-universal `flex-row ... items-center` convention already used everywhere else in this
codebase; this component was the one place missing it. No prop/type changes, no migration.

Browser-verified live (Chrome, `npm run web`): confirmed broken on a clean post-reload repro
first (both Shopping AND Transfer), then confirmed the one-line fix resolves both instantly and
reliably across repeated navigate-away-and-back cycles (Shopping → Transfer → Stuff → Transfer →
Prework, all checked). `npm run typecheck` / `npm test` green (pure layout change).

**File:** `apps/mobile/src/components/SegmentedControl.tsx` only.

## Status
`npm run typecheck` exits 0; `npm test` green (510 vitest tests across 3 workspaces + marketing
site checks). Migration + edge function **deployed dev + prod**; CLI left re-linked to dev.
**Client code NOT committed** — staged only, per [[commit-discipline]].

**Browser-verified (Chrome, `npm run web`, colorful theme) same session:** (1) on the live
"Summer in Greece" dev trip's Beachday activity, clicking well right of the maps-link text in the
expanded detail panel opened nothing (no new tab) while clicking the link text itself still opened
a new tab — confirms the tap-target fix works both ways. (2) created a real activity with "Allow
document uploads" on; its detail panel rendered the DOCUMENT section with all 4 trip members,
correct per-member "Add document" gating (only shown for the logged-in member, since that account
isn't the organizer), test activity deleted afterward. (3) switched the test account's language to
German and back: Transfer "All" tab showed "Hin- und Rückflug" for a flight next to "Hin- und
Rückfahrt" for a vehicle in the same list; Vehicles tab section header, VehicleCard badge, and
CreateVehicleSheet's 3-way picker all read Hinfahrt/Rückfahrt/Hin- und Rückfahrt correctly.
No device (native) build tested — web-only, consistent with how most prior batches in this project
first verify. Dev server stopped and language setting restored to English after testing.

Related: [[v1-39-2-batch]], [[no-branches-main-only]], [[commit-discipline]],
[[edge-function-redeploy-after-edit]].
