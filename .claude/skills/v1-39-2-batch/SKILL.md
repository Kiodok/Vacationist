---
name: v1-39-2-batch
description: Use to answer "what's in v1.39.2" / status of v1.39.2, or before touching EditExpenseSheet's settled-split lock, RichText's linksInteractive prop, the get_trip_cost_summary/get_my_trip_cost_shares RPCs, expenses.related_id, PassengerSelectSheet, or flight/PT passenger assignment. Records the v1.39.2 batch — trip description selection, a settled-expense metadata-only edit lock, a RichText hyperlink tap-area fix, a cost-analysis double-counting fix via expenses.related_id (later narrowed to flights/accommodations/rentals only — public transport is now excluded from the cost analysis entirely and never prompts for a linked expense), pre-booking flight passenger assignment, and a PassengerSelectSheet reset-on-open bug fix.
---

# v1.39.2 batch

Four original items from the Tech Lead's 2026-10-03 `/plan` request, plus two follow-up rounds of
small fixes, plus a later round reworking booking-prompt/passenger-assignment behavior. All
code-complete (`npm run typecheck` + `npm test` green).

**Deployment (re-verified 2026-10-03 via `supabase migration list` on both projects, not just
memory): 5 migrations now exist** (`20261003100000/110000/120000/130000/140000`) **— all applied
on DEV, confirmed full ledger parity** (`140000`, §5 below, was still pending when first checked —
explicitly pushed with `supabase db push`, then re-verified). **Confirmed NONE are on prod** —
`remote` empty for all 5 on `fsfsqghbejwvgxujoyne`. `140000` is dormant-safe the same way
`110000`/`120000` are — the live prod client still gates its "Passengers" button on
`flight.status === 'booked'` client-side, so it never exercises the now-relaxed DB permission even
once pushed — but it's stuck behind the identical ordering blocker. Prod push for the dormant-safe
ones was attempted and blocked by the Claude Code auto-mode classifier mid-sequence (see
[[prod-deploy-classifier-blocks-file-prep]]); on a later re-check in this same session, explicitly
declined to retry that workaround rather than re-attempt it under a different framing.
`20261003100000` must never go to prod alone (see §2) — and neither can `20261003130000`, since
it's a `CREATE OR REPLACE` of the same function and carries `100000`'s settled-split guard
forward. `supabase db push` has no per-migration selection; it applies all pending migrations in
timestamp order, so none of `110000`/`120000`/`140000` can be cherry-picked without resequencing
files — the exact action the classifier already denied. **Tech Lead's explicit call, given twice
now (`AskUserQuestion`, both times choosing the Recommended option): wait for the client to be
approved for commit, then push all migrations to prod in that same session** — this is precisely
CLAUDE.md's "migrations never get ahead of the client" rule, not a one-off judgment call. **Client
NOT committed** — pending the Tech Lead's go-ahead. CLI session left re-linked to dev (the
default) after each prod-status check. See [[no-branches-main-only]] and [[commit-discipline]].

## 1. Trip description selectable
One-line fix: `apps/mobile/app/trip/[id]/overview.tsx` passes `selectable` to the `<RichText>`
rendering `trip.description` — the prop already existed on the component, just wasn't used here.

## 2. Settled expense: lock money fields, allow metadata edits
**Why:** `update_expense_with_splits` always `DELETE`s and re-`INSERT`s every `expense_splits`
row on every save, defaulting non-payer splits back to `'open'` — so editing even just a
description on a settled expense silently unsettled it.

**Lock condition (Tech Lead's explicit call): ANY non-payer split settled, not full settlement.**
`hasAnySettledSplit()` in `packages/utils/src/settlements.ts` — deliberately broader than the
existing `isExpenseFullySettled()` (which still backs the `ExpenseCard` "Settled" badge; that
display logic is unrelated and untouched).

**Locked:** amount, currency, tip, paid_by, split_method, split-among.
**Always editable:** title, description, category (`related_type`), `is_business`, documents.

**Permanently locked, no inline unlock (Tech Lead's explicit call).** `EditExpenseSheet` shows
the locked fields read-only with a banner + a button that closes Edit and opens
`ExpenseSplitBreakdown`, where the existing "Reopen" action (`unsettle_expense_split`, already
built) is the only way back to editable. Don't build a second unlock path.

**New RPC:** `public.update_expense_metadata` (title/description/related_type/is_business only,
never touches `expense_splits`) —
`supabase/migrations/20261003100000_expense_metadata_only_update.sql`. `EditExpenseSheet` branches
in `onValid`: `hasSettledSplit ? onSubmitMetadata(...) : onSubmit(...)`. Full persisted-mutation
workflow followed: `UpdateExpenseMetadataInput`/`Variables` in `packages/types`,
`updateExpenseMetadata()` in `packages/api/src/expenses.ts`, `useUpdateExpenseMetadata()` hook,
`setMutationDefaults(['updateExpenseMetadata'], ...)`, registered in both
`PERSISTED_MUTATION_KEYS` and `COST_AFFECTING_MUTATION_KEYS` (a category change affects the cost
analysis) in `apps/mobile/src/utils/queryClient.ts`.

**Defense in depth:** `update_expense_with_splits` itself now `RAISE EXCEPTION`s if any non-payer
split is already settled, so a stale/bypassed client can't silently unsettle one even if the UI
gate is skipped.

## 3. Hyperlinks shouldn't steal taps from a card
**Root cause:** `RichText` renders an inline `<Text onPress>` per detected `https://` segment.
React Native's nested-Text hit-testing can extend that link's touchable region across the rest of
its text line — including trailing empty space — stealing taps meant for an OUTER
Pressable/TouchableOpacity wrapping the whole thing (a card's open/expand action). This is a
known RN quirk, not specific to this app. `RichText.tsx`'s old doc comment claimed links "do not
have the same touch-swallowing problem" as `selectable` — that claim was wrong and has been
corrected.

**Fix:** `RichText` gained `linksInteractive?: boolean` (default `true`). `false` keeps the
link's color+underline styling but drops `onPress` — visually a link, doesn't intercept touches.

**Set `linksInteractive={false}`** on every RichText sitting inside a card whose outer Pressable
does something ELSE than follow the link: `ActivityCard`, `AccommodationCard`, `RecipeCard`,
`TripCard`, `VehicleCard` (its notes row has its OWN separate inner Pressable for
expand/collapse — same conflict class, same fix), `NoteCard`.

**Left interactive** (no competing outer Pressable over the same text):
`SharedPackingItemCard`, `LostFoundCaseCard`, `ActivityNoteItem`, `ChatMessageRow`,
`CalendarActivitySheet`, `ViewNoteSheet`, `AllTransfersView`'s summary cards.

**Verify the actual Pressable nesting per file before flipping the prop — don't assume from the
component name.** `PackingItemRow`'s outer Pressable only has `onLongPress`, no `onPress`, so a
short tap on a link there never competed with anything; it was NOT touched despite looking like
the others.

**Completion detail:** `activities.tsx`/`accommodations.tsx`'s expanded detail panels used to
render descriptions as plain `<Text>` (no link support at all). Upgraded to
`<RichText selectable>` so a link stays reachable somewhere once the card preview's copy is
non-interactive.

## 4. Cost-analysis double-counting fix
**The bug:** a booked accommodation/flight (or a priced rental/PT entry) AND a separately-created
expense for that same booking both counted toward the trip cost analysis. The old client-side
heuristic in `packages/utils/src/costSummary.ts` (an entity category's own price sum `> 0`
suppresses its matching `expense_*` bucket) only caught this when the expense's `related_type`
happened to match the entity's category — real production data showed users very often pick a
different/generic category for that expense instead.

**Fix (Tech Lead's explicit call): use `expenses.related_id`** — already existed on the table,
already wired end-to-end client→RPC→DB (`CreateExpenseSheet` input →
`packages/api/src/expenses.ts` → `create_expense_with_splits`'s `p_related_id` →
`expenses.related_id`), but no UI had ever populated it before this. Chosen explicitly over a
static `expense_created` boolean flag because it's **dynamic/self-healing**: archiving, deleting
or re-categorizing the linked expense automatically makes the entity count again, with zero extra
code — a boolean flag would go stale in all three of those cases.

`get_trip_cost_summary` / `get_my_trip_cost_shares`
(`supabase/migrations/20261003110000_cost_summary_related_id_exclusion.sql`) now exclude an
`accommodations`/`transfer_flights`/`transfer_rentals`/`transfer_public_transport` row from the
entity sum once a **live** (`archived_at IS NULL`) expense exists with `related_id` = that row's
id. New partial index `idx_expenses_related_id` backs the `EXISTS` lookups.

**`packages/utils/src/costSummary.ts` simplified to match:** for `base`/`transfer`,
`expense_accommodation`/`expense_transport` are now unconditionally additive (same bucket as
`expense_manual`) — the exclusion is now exact and per-row at the SQL level, so the client no
longer needs to guess from category-level entity presence. `activity`/`expense_activity` originally
kept the OLD heuristic (`hasActivityEntity`) here, explicitly out of scope for this item — **but
see the follow-up round below: a separate, same-day decision removed `activity.cost_estimate`
from the analysis entirely, which made that heuristic moot and it was deleted outright.**

**Scope (Tech Lead's explicit call, multi-select): accommodations + flights (Book-time popup)
AND rentals + public transport** (price-first-set popup — no Book/status step on those two, so
"price goes from unset/zero to positive" is the trigger, and it only fires once per entity).
`promptExpenseForEntity()` in `transfer.tsx` encodes this "only once" guard.

**No "link an existing expense" picker** (Tech Lead's explicit call) — `CreateExpenseSheet`'s new
`prefill?: ExpensePrefill` prop only gets set by the booking/price-set flow itself. Do not add a
retrofit picker without a fresh Tech Lead call.

**Already-double-counted historical trips are NOT backfilled** (Tech Lead's explicit call) — this
fixes new bookings only, by design. Don't write a backfill migration without asking first.

## Code-review follow-up (2026-10-03, same day)
`/code-review` on the local diff found 5 issues, 4 real and fixed:
1. **Trip-scope `related_id`** (`20261003120000_cost_summary_trip_scope_related_id.sql`) — the
   `NOT EXISTS` added in `20261003110000` matched purely on `related_id` with no `trip_id`
   scoping, and `create_expense_with_splits` never validated `p_related_id` belongs to
   `p_trip_id`. A cross-trip id could silently exclude a DIFFERENT trip's entity from its own
   cost summary. Fixed both the read side (every `NOT EXISTS` now also requires
   `e2.trip_id = <row>.trip_id`) and the write side (`create_expense_with_splits` rejects a
   `p_related_id` outside the trip).
2. **Staged-document upload race** — `accommodations.tsx`/`transfer.tsx`'s booking prompt fired
   the document upload in parallel with `createExpense.mutate()` instead of in its `onSuccess`,
   and swallowed failures. Fixed to match `expenses.tsx`'s established
   `uploadStagedExpenseDocuments` pattern exactly.
3. **Missing price>0 gate on accommodation/flight booking prompts** — only the rental/PT paths
   had the gate (via `promptExpenseForEntity`); booking an unpriced accommodation/flight opened
   the expense sheet with an invalid 0.00 amount. Flights now route through
   `promptExpenseForEntity` too; accommodations gained `onAccommodationBooked`.
4. **Stale title in rental/PT update prompts** — `handleUpdateRental`/`handleUpdatePublicTransport`
   captured the entity's pre-edit title instead of `input.title`, so renaming + pricing an entity
   in the same save showed the old name in the banner.

**Judged acceptable, not changed:** the booking prompt isn't wired through the persisted-mutation
`mutationDefaults.ts` pattern, so it's silently skipped if the triggering mutation is queued
offline and replays after an app kill. Same shape as the already-documented, already-accepted gap
on `uploadStagedExpenseDocuments` itself — a secondary, non-critical UX nicety, not core
correctness. Don't "fix" this into the full persisted-mutation machinery without a fresh Tech
Lead call; it's deliberate.

## Follow-up round (2026-10-03, same day, after the prod-push discussion)

Four more small fixes, from Tech Lead questions/reports while deploying. All pure client/i18n
changes except one new migration.

1. **`activity.cost_estimate` removed from the cost analysis entirely** (a separate, later
   decision from item 4 above — supersedes the "activity keeps the old heuristic" note there).
   It's a rough per-item planning number, not a committed cost — a "Dinner" activity's real cost
   shows up later as an actual expense instead. `computeTripCostSummary`/`computeMyCostShares`
   now never sum an `activity` entity row into any bucket; `CostCategory` dropped to `'base' |
   'transfer' | 'expenses'`; `EXPENSE_FALLBACK_SOURCE`/`FALLBACK_EXPENSE_SOURCES`/
   `hasActivityEntity` deleted outright — every `expense_*` source, `expense_activity` included,
   is now unconditionally additive (matches `base`/`transfer`'s existing post-`related_id`-fix
   behavior). Confirmed via grep that `byCategory` was never rendered in any UI (`overview.tsx`/
   Analytics only read `.total`/`.excludedSourceCount`) — pure `costSummary.ts` change, **no
   migration**, no UI category to remove. `cost_estimate` the field/input/`ActivityCard` display
   are untouched — only the aggregate stopped counting it.
2. **Activity cost_estimate input didn't accept `,` or a trailing `.`** — same bug class already
   fixed everywhere else in the app: `CreateActivitySheet.tsx`/`EditActivitySheet.tsx` bound the
   `TextInput`'s `value` straight to `String(parsedNumber)`, so typing `116,` collapsed the
   display back to `116` before the fractional digits could be typed (`11690`, not `116.90`).
   Fixed with the same `costText` local-state + `sanitizeDecimalInput` pattern
   `CreateExpenseSheet.tsx` already uses.
3. **Public transport's price field was mislabeled "Total price"/"Gesamtpreis"** — confirmed from
   the live RPC (`price_total * participant_count`) and `computeMyCostShares` (gated
   full-price-when-`is_mine`, same bucket as flights) that it's already **per-person** internally
   (the v1.34.1 Tech Lead call, see [[v1-34-1-batch]]). Rentals ARE a genuine flat total (summed
   directly, divided evenly) — this mislabeling is PT-only, don't touch rentals. Relabeled to
   "Price per person"/"Preis pro Person"; added the existing `{t('all.perPerson')}` ("/ person")
   suffix to `PublicTransportCard.tsx` and `AllTransfersView.tsx`'s PT summary, matching how
   flights already display `price_per_person`. (`PublicTransportSummaryCard` in
   `AllTransfersView.tsx` had no `useTranslation` call of its own — added it.)
4. **"Add shopping list"'s name field was labeled "Item"** (`t('field.item')`, copy-pasted from
   an item-adding form) — new `field.listName` key ("List name"/"Listenname"). Also found
   `EditShoppingListSheet.tsx` ("Rename list") had **zero i18n** — every string hardcoded English,
   silently no German translation, ever. Converted to `field.listName` + the existing
   `placeholder.listName` + new `edit.renameList` key.

## Code review on the follow-up round (2026-10-03, later still)

`/code-review` on that round's diff found 7 issues. 3 were clear mechanical bugs, fixed
immediately: (1) `update_expense_with_splits`'s new settled-split guard ran BEFORE the
trip-membership/permission checks — a non-member could learn an expense's settlement state
before being told "Not a trip member"; fixed in a new migration
(`20261003130000_update_expense_with_splits_auth_order.sql`, reordering only, pushed to dev) —
can't edit `20261003100000` in place, it's already on dev. (2) `ExpensePrefill` had no `currency`
field, so the booking-linked expense always defaulted to the trip's base/last-used currency
instead of the booked entity's own (Phase 15 multi-currency) — added `currency: Currency`,
populated from each entity at all 4 call sites. (3) `transfer.tsx`'s booking-prompt
`CreateExpenseSheet` mount checked `members &&` like `accommodations.tsx` does, but `members`
defaults to `[]` there (truthy even before `useTripMembers` resolves, unlike
`accommodations.tsx`'s `undefined`-while-loading) — changed to `members.length > 0`.

**The other 2 findings were genuine product trade-offs, surfaced via `AskUserQuestion` rather
than guessed at — both now resolved by explicit Tech Lead decisions (2026-10-03):**

- **Amount-prefill accuracy.** Tech Lead's answer: **"Leave blank, require manual entry"** (the
  Recommended option). Implemented with a refinement beyond the literal question: the blank-out
  only applies where the price is genuinely per-person (flights, public transport) — NOT to
  accommodations/rentals, which are confirmed genuine flat totals (no per-person ambiguity) and
  keep their real-amount prefill unchanged. `promptExpenseForEntity()` in `transfer.tsx` was
  reshaped to take `priceSignal` (what gates showing the prompt — unchanged) separately from
  `prefillAmount: number | undefined` (what goes in the form): flights and PT now pass
  `undefined`; rentals pass the real flat total, same as before. `ExpensePrefill.amount` in
  `CreateExpenseSheet.tsx` became optional (`amount?: number`) to allow this, with the
  `amountText` initial-state guarded against `prefill.amount` being `undefined` (was previously
  `prefill.amount.toFixed(2)`, a crash risk once `amount` could be missing).
- **Manual-expense double-count regression.** Tech Lead's answer: **"Accept it as a known gap"**
  (the Recommended option) — no retrofit "link an existing expense" picker, no further mitigation.
  Consistent with the already-accepted "no picker, no backfill" calls elsewhere in this item;
  formally confirmed as a known, accepted limitation rather than silently re-assumed.

## PT amount-prefill follow-up (same day, after the Tech Lead flagged it as friction)

**Superseded less than 2 hours later — see §5 below.** `computePublicTransportGroupTotal` (this
section's whole fix) was deleted outright once the Tech Lead, after actually using it, decided
the PT booking-prompt shouldn't exist at all, not just that its amount needed fixing. Kept here
for the reasoning trail (why PT's "can't know the count" claim was wrong, which is still true and
still relevant background), but nothing described in this section is live code any more.

The "leave blank" decision above was reported back as unwanted friction, **PT-specific**: "It
works everywhere else, also for rentals — I need to re-type it." Investigation found the original
"can't know the real count" reasoning was actually flight-specific, not PT-specific —
`transfer_public_transport_passengers` has **no** `status`-gate equivalent to flights'
`status='booked'` requirement (confirmed in that table's own creation-migration header comment,
`20260905160000_create_transfer_public_transport_passengers.sql`), so by the time someone edits
an existing PT entry to set its price, real passengers/tickets very often already exist.

**Fix:** new `computePublicTransportGroupTotal(ptId, perPersonPrice)` helper in `transfer.tsx`,
mirroring `get_trip_cost_summary`'s own PT math exactly — `price_total × COUNT(DISTINCT user_id)`
over `transfer_public_transport_passengers ∪ transfer_documents` (ticket holders) — reusing the
same TanStack Query cache keys the existing passenger/document hooks use
(`['transfer-public-transport', ptId, 'passengers']` / `'documents'`), so a warm cache (e.g. the
card was already expanded) avoids an extra fetch. Uses `getPublicTransportPassengers`/
`getPublicTransportDocuments`, both already exported from `@vacationist/api`.
`handleUpdatePublicTransport`'s `onSuccess` is now `async` and awaits this before calling
`promptExpenseForEntity`; `handleCreatePublicTransport` is unchanged — a brand-new PT row can't
have passengers/tickets yet (both reference the row's own id), so there's nothing to compute.
Resolves to `undefined` (blank, same as before) on fetch failure or an empty participant union,
so a €0.00 prefill — invalid per `amount: z.number().positive()` — can never happen.

**Flights are untouched.** Their `status='booked'` DB-trigger gate is a real structural
constraint (passengers can only be assigned after booking succeeds, so count is always 0 at the
exact trigger moment) — not a missed optimization like PT's was. Rentals/accommodations were
already correct (genuine flat totals, no per-person math needed).

Pure client fix — no migration, OTA-eligible. `npm run typecheck` + `npm test` green after.
`promptExpenseForEntity`'s shared doc comment was rewritten to scope the "can't know the count"
claim to flights only. Docs kept in sync in the same pass: `CreateExpenseSheet.tsx`'s
`ExpensePrefill.amount` comment, `engineering/software_engineering_guide.md`'s cost-analysis
section, this skill + its paired memory, and the **"Vacationist v1.39.2 QA"** artifact
(`https://claude.ai/artifact/XLP78b4PDoPzBQuAG1TZMZ`) — `book-prompt`/`book-prompt-rental`/
`book-prompt-blank-amount` items and the "Known & expected" block updated to split flights
(still blank) from PT (prefilled when participants/tickets exist), same item ids kept.

## 5. Passenger-sheet bug + PT booking-prompt removed + pre-booking flight passengers (same day, later still)

Three related Tech Lead reports/requests, landed together since the third reuses the group-total
helper the first two made obsolete for PT.

**(a) `PassengerSelectSheet` reset-on-open bug.** "I click join, open the passenger list, I'm not
there, I must reselect everyone." Shared by flights/vehicles/PT — all three mount it via
`transfer.tsx` (`apps/mobile/src/features/transfer/components/PassengerSelectSheet.tsx`). Root
cause: its local `selected` Set was seeded once at mount (`useState(new Set(selectedUserIds))`) —
often before the passenger query had even resolved, since all three parents always-mount it with
a `visible` prop and no `key` — and never resynced afterward. Confirming from that stale-empty set
was also silently destructive: the vehicle/PT confirm handlers diff-delete against it (so
confirming wiped real passengers), and the flight path does a full atomic replace (so confirming
could wipe the entire flight passenger list). Fixed:
```tsx
useEffect(() => {
  if (visible) {
    setSelected(new Set(selectedUserIds));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [visible]);
```
Deliberately depends on `[visible]` alone, NOT `selectedUserIds` — every parent rebuilds that
array via `.map()` on every render, so including it would re-seed (discarding in-progress
checkbox edits) on every parent re-render while the sheet is already open, not just on the actual
open/close transition. `[visible]` alone only fires on that transition, and the effect closure
still sees that render's current `selectedUserIds` — exactly the behavior wanted. Same
"reset-on-open" pattern already used correctly elsewhere (`EditVehicleSheet.tsx`,
`EditActivitySheet.tsx`), just narrowed to avoid this sheet's specific footgun (an
always-fresh-identity array prop).

**(b) PT booking-prompt removed entirely.** Tech Lead: prompting the instant a PT entry's price
is set is premature, unwanted UX — "sometimes you don't even know who will use the public
transport or if another user joins later." `handleCreatePublicTransport`/
`handleUpdatePublicTransport` in `transfer.tsx` no longer call `promptExpenseForEntity` at all;
`computePublicTransportGroupTotal` (§ above) deleted outright — nothing calls it any more.

**(c) PT excluded from the cost analysis entirely — the explicit consequence of (b).** Asked via
`AskUserQuestion` whether permanent PT double-counting (no `related_id` can ever be set for PT
now that its only setter is gone, and there's deliberately no manual link picker) was an
acceptable trade-off. Tech Lead declined the "accept it" option: **"then public-transport costs
should not be included in the analytics anymore."** `packages/utils/src/costSummary.ts`:
`transfer_public_transport` dropped from `ENTITY_SOURCES_BY_CATEGORY.transfer`
(`computeTripCostSummary` needs no other change — it simply becomes an unrecognized source, same
as `activity`), and added to `computeMyCostShares`'s early-skip condition alongside `activity`:
```ts
if (row.source === 'activity' || row.source === 'transfer_public_transport') continue; // never part of the analysis
```
A manually-recorded "Transport"-category expense still counts (`expense_transport` stays
unconditionally additive, same as `expense_manual`/`expense_activity`) — only the PT entity's own
price stops being summed. No RPC/migration change needed — the RPCs keep emitting the
`transfer_public_transport` row (now correctly priced via real participant counts, from the §
above's work), the client just ignores it, exactly like it already ignores `activity`. 3
`costSummary.test.ts` assertions updated to match (66 tests passing, down from 67 — one
describe block collapsed from 2 tests to 1 since both `is_mine` branches now assert the same
zero result).

**(d) Flights: pre-booking passenger assignment, organizer-only.** This is *why* the flight
booking-prompt always opened blank in the first place — passengers could only be assigned after
`status = 'booked'`, enforced by **two independent gates** found in
`20260522000002_create_transfer_flight_passengers.sql`: a `BEFORE INSERT` trigger
(`on_transfer_flight_passenger_insert_verify` / `verify_flight_booked_before_passenger()`) AND a
duplicate `IF v_status IS DISTINCT FROM 'booked'` check inside `set_transfer_flight_passengers`
itself (the RPC is `SECURITY DEFINER` and the only write path, so RLS alone was never the real
gate). New migration `20261003140000_allow_prebooking_flight_passengers.sql` drops the trigger +
its function and `CREATE OR REPLACE`s the RPC with that one check removed — every other check
(auth, organizer-only permission via `private.is_trip_organizer`, per-user
`private.is_trip_member` validation, atomic delete+insert replace) is unchanged, same signature.
**Tech Lead's explicit call: stays organizer-only** — no self-join widening to match PT/vehicles,
smallest-change option chosen over the alternative offered.

Client (`transfer.tsx`): `canManagePassengers` dropped its `flight.status === 'booked'` condition
(now just `role === 'organizer'`) — true in all three flight states (`suggested`/`booked`/
`completed`, confirmed via the table's `CHECK` constraint, unchanged by this work). The passenger
chip-list display gate dropped the same condition. New `computeFlightGroupTotal` — same shape as
the now-deleted PT helper, using `getTransferFlightPassengers`/`getTransferFlightDocuments` (both
already exported from `@vacationist/api`) over query keys `['transfer-flights', flightId,
'passengers'|'documents']` — wired into the `onBook` success handler, so the booking prompt
finally prefills `price_per_person × distinct(passengers ∪ ticket holders)` instead of always
blank. **`get_trip_cost_summary`/`get_my_trip_cost_shares`'s flight branches keep their existing
`status IN ('booked', 'completed')` filter unchanged** — this migration only changes *when*
passengers can be assigned, not when a flight counts toward the trip total (a deliberate scope
boundary — the Tech Lead asked about the booking-prompt, not the aggregate RPC's status gate).

**Also fixed while here** (pre-existing gap, per this project's "fix issues found during work"
rule): `useSetTransferFlightPassengers`'s (`useTransferFlightPassengers.ts`) `onSuccess` never
called `invalidateCostQueries`, unlike the PT hook's equivalent — fixed to match, since
pre-booking assignment + the Book-time prompt now both depend on this data staying fresh.

Docs updated in the same pass: `promptExpenseForEntity`'s doc comment in `transfer.tsx`,
`ExpensePrefill.amount`'s doc comment in `CreateExpenseSheet.tsx`,
`software_engineering_guide.md`'s cost-analysis section (PT's paragraph replaced, `activity`'s
paragraph merged with PT's exclusion reasoning into one), this skill + its paired memory, and the
**QA artifact** — PT items replaced with "no prompt fires" + "excluded from the total" checks, new
flight pre-booking + real-group-total checks, new `PassengerSelectSheet` fix check. `npm run
typecheck` + `npm test` (245 tests) green after all of the above.

## Also fixed mid-session (pre-existing, unrelated)
`marketing/site/build.mjs`'s `APP_VERSION` constant was stale (`1.39.1`) against
`apps/mobile/app.config.ts` (already bumped to `1.39.2` before this session started) —
`marketing/site/site.test.js`'s drift check caught it on a routine `npm test` run. Fixed the
constant and corrected its comment, which incorrectly claimed the bump is only needed on
MINOR/MAJOR releases — the test asserts exact equality on every release, patch included.

Related: [[no-branches-main-only]], [[commit-discipline]], [[settled-trip-predicate]],
[[v1-34-0-batch]], [[v1-34-1-batch]], [[prod-deploy-classifier-blocks-file-prep]].
