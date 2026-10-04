---
name: v1-39-4-batch
description: Use to answer "what's in v1.39.4" / "status of v1.39.4", or before touching Activity cost_estimate/currency, the create_activity RPC, ActivityCard's currency display, or the currencies/ feature folder's per-entity hook pattern.
---

v1.39.4 added a `currency` dropdown next to the Activity Cost Estimate field, closing the last gap
in the item-12 currency work (Transfers got it 2026-09-04, Accommodations 2026-09-05 — Activities
was explicitly scoped out at the time, per the Accommodation migration's own comment).

**Why:** an activity's cost estimate can be in a different currency than the trip, and changing
the trip's currency later must not retroactively reinterpret an already-estimated activity cost —
same bug class already fixed for Transfers and Accommodations.

**How to apply:**
- `activities.currency TEXT NOT NULL REFERENCES currency_catalog(code)` — migration
  `20261004100000_add_activity_currency_column.sql`, DEPLOYED dev + prod 2026-10-04.
- Unlike Accommodation (direct `.insert()`), activity creation goes through the `create_activity`
  RPC — it gained a trailing `p_currency TEXT DEFAULT NULL` param (DROP+CREATE required; Postgres
  forbids changing a signature via `CREATE OR REPLACE`), with a defensive
  `COALESCE(p_currency, trips.base_currency)` fallback. `updateActivity()` needed no RPC change —
  it's a plain `.update(input)`.
- **No RPC changes to cost-analysis** (`get_trip_cost_summary`/`get_my_trip_cost_shares`) —
  `activities.cost_estimate` is deliberately excluded from cost analysis entirely, for a reason
  unrelated to currency (rough planning number, not a committed cost — see
  `packages/utils/src/costSummary.ts`). Don't assume adding a currency column means you also need
  to wire it into the cost-summary RPCs — check whether the entity is summed into analysis first.
- Shared currency-field plumbing per entity family: `apps/mobile/src/features/currencies/` has one
  small hook + one MMKV storage util **per entity** (`useActivityCurrencyField.ts` +
  `lastUsedActivityCurrency.ts`, sibling to the Accommodation/Transfer pairs) — each entity
  remembers its own "last used currency" habit independently (a flight/accommodation/activity are
  often paid in different currencies). The actual UI button + picker sheet
  (`EntityCurrencyField.tsx`, `CurrencyPickerSheet.tsx`) is fully shared and entity-agnostic — never
  duplicate it, just add a new hook/util pair.
- `ActivityCard`/`AccommodationCard`/`FlightCard`/`RentalCard` all read `<entity>.currency`
  directly — none of them take a `currency` prop. If you're threading a `currency` prop down to one
  of these from a trip-level variable, you're probably fighting this pattern.
- Quirk hit while browser-testing this batch: in this dev environment, Chrome (via the
  `claude-in-chrome` extension) and `curl` both hung/timed out against `http://localhost:8081` for
  the Expo web dev server, but `http://127.0.0.1:8081` worked immediately. Try the explicit IP
  first if `localhost` seems to hang.
