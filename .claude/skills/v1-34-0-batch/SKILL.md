---
name: v1-34-0-batch
description: Progress tracker for the v1.34.0 release — a 12-item batch (Web Push notifications, a new global Analytics tab, Balances donut-chart improvements, a Trip Overview cost summary, persistent per-entity currency for Transfers AND Accommodations, business-cost flag extended to Base/Transfers, a trip end-date calendar bug fix, an Android quick-action icon fix, and expense-document camera capture). All code-complete as of 2026-09-05, migrations + Edge Functions deployed to dev AND prod, web push CONFIRMED WORKING end-to-end (a malformed VAPID_PUBLIC_KEY secret was the actual bug, found and fixed), NOTHING committed yet — pending only a physical-device test for the quick-action icon and a System-theme visual QA spot-check. Use to resume work or answer "what's the status of v1.34.0."
---

# v1.34.0 batch progress

Plan file: `C:\Users\Gary\.claude\plans\robust-sparking-glacier.md` (the approved implementation
plan for all 12 items, written after a `/plan` pass with an extensive Testing Plan section per
user request). This skill file is the durable record of what was actually built, since the plan
file describes intent, not final state.

**Nothing has been committed yet** — per [[commit-discipline]], the user tests first. `npm run
typecheck` and `npm test` (root) are green throughout; every migration was applied to dev then
prod (ledger parity confirmed each time) since none were destructive (all additive
columns/tables/RPCs). Full changelog detail for every migration lives in `engineering/supabase.md`
(eight 2026-09-04/05 entries as of the accommodation-currency extension below) — this file
summarizes decisions and status, not the SQL itself.

## Done (all 12 items code-complete)

1. **Trip end-date calendar bug — fixed twice; second fix found the REAL root cause
   (2026-09-05, later same day).** Original root cause: `app/(tabs)/calendar.tsx`'s global
   month-grid coverage band built its own date set with bare (non-UTC) `dayjs()` — silently
   dropped the end date on any device behind UTC. First fix: reuse the already-correct
   `generateDateRange` (used elsewhere) instead of a duplicated unsafe loop, using
   `dayjs.tz(dateString, trip.timezone)` internally. 4 new tests (DST transitions, year-boundary
   crossing) — all passed, all run under Node/V8.
   **The Tech Lead reported the bug was STILL live**, with precise new symptoms that broke the
   case for the first fix: reproduced on BOTH the per-trip Calendar tab (day strip) AND the
   global Calendar tab (month-grid dots) — both call `generateDateRange` — but reproduced
   ONLY on Android/iOS, never on Web, and never in the test suite. I verified the pure date-math
   was correct by extracting the exact algorithm into a real Node script and running it against
   the same year-changed/DST/month-boundary scenarios the tests already cover — every one came
   back correct. That "identical logic, wrong only on native" pattern pointed at the JS engine,
   not the algorithm: `dayjs.tz(dateString, timezone)` resolves a named IANA zone via
   `Intl.DateTimeFormat`, and Hermes (React Native's engine) can resolve that differently than
   V8 (Node/browser) — explaining every fact at once, including why the test suite (Node-only)
   never caught it. **Real fix:** recognized that `generateDateRange` never actually needed a
   named timezone at all — `start_date`/`end_date`/`activity_date` are plain `DATE` values with
   no time-of-day, and enumerating calendar days between two dates is pure date arithmetic with
   no genuine DST/UTC-offset/timezone-database dependency. Dropped the `timezone` parameter
   entirely; always parse with `dayjs.utc()` (no IANA lookup, no Hermes-dependent failure mode).
   Also split `formatCalendarDayHeader`'s two concerns: `dayName`/`dayNumber`/`monthShort` (pure
   labels of an already-known date) now use `dayjs.utc()` too; `isToday` (a genuinely
   timezone-of-current-instant question) keeps its real `dayjs().tz()` dependency, flagged as an
   untested residual risk if Hermes's zone resolution really is unreliable — worth an on-device
   spot-check of the "today" ring separately, since it wasn't part of what was reported broken.
   **Lesson: a bug report of "identical code, wrong only on native, never in CI" is a strong signal
   to suspect the JS engine (Hermes vs. V8/Node) before re-auditing the algorithm — and the most
   robust fix is often removing a dependency (named-timezone resolution) the code never actually
   needed, not deepening it.**

2. **Android quick-action icon — CONFIRMED root cause found and fixed 2026-09-05.** The v1.33.1
   raster-PNG+keep.xml fix was correct but the icon still showed the robot glyph — initially
   suspected (unconfirmed) OEM launcher icon caching by shortcut id, fixed defensively by bumping
   the shortcut id to `'add-expense-v2'` (kept as insurance, but not the real cause). The Tech
   Lead's actual report — works on an EAS `development` build and on iOS prod, fails specifically
   on **Android production via the Play Store**, on multiple real devices — pointed at the real
   cause: `withQuickActionIcon.js` shipped the icon only in the density-qualified
   `drawable-xxxhdpi/` folder, but `production`'s `eas.json` `buildType` is `app-bundle`, and
   Google Play's bundletool splits App Bundle resources by device density by default — any device
   whose density split isn't exactly xxxhdpi got a Play-generated APK missing the drawable
   entirely (not stripped by R8, never packaged into that split in the first place). Fixed by
   moving the icon to the density-**independent** default `drawable/` folder, which bundletool
   always includes regardless of device density. Verified via `expo prebuild -p android --clean`
   (icon now lands in `res/drawable/`, not `drawable-xxxhdpi/`). Full writeup:
   [[android-runtime-resource-shrinking]]. **Still needs the Tech Lead's real Play Store
   production install test to fully confirm** — a local prebuild only proves the resource is in
   the right folder, not that bundletool's real per-device split includes it.

3. **Persistent per-entity currency for Transfers — later extended to Accommodations too.** New
   `currency` column on `transfer_flights`/`transfer_rentals`/`transfer_public_transport`
   (migration `20260904130000`), backfilled from each row's trip's currency at migration time.
   `CurrencyPickerSheet` added to all 6 create/edit sheets; new entries default to a remembered
   "last used transfer currency" (separate MMKV key from the expense one — different currency
   habits), editing always shows the row's own currency, never the trip's live one. Fixes the
   reported bug (changing trip currency was retroactively reinterpreting old flight/rental
   prices). **2026-09-05 extension:** the Tech Lead asked to close the gap this item originally
   left open ("priced types only" excluded Accommodations) — `accommodations` got the identical
   treatment (migration `20260905130000`, `get_trip_cost_summary`/`get_my_trip_cost_shares`
   updated via `20260905140000` since both had hardcoded the accommodation row to the trip's
   `base_currency`), its own "last used accommodation currency" MMKV habit, and the
   `TransferCurrencyField` UI component was renamed `EntityCurrencyField` (it had zero
   transfer-specific logic) so Accommodation could reuse it directly. Two adjacent pre-existing
   bugs fixed in the same pass: the Trip Export Markdown/PDF (`tripMarkdown.ts`, a separate export
   from the Business Summary) still used `trip.base_currency` for flight/rental prices since item
   12 shipped without updating it; and `create-example-trip`'s two accommodation inserts were
   missing the new NOT-NULL `currency` field (same class of gap already fixed for the 3 transfer
   tables' seed rows). Full detail: `engineering/supabase.md`'s "extend persistent per-entity
   currency to Accommodations" entry.

4. **Business-cost flag extended to Base + Transfers.** `is_business` added to `accommodations`,
   `transfer_flights`, `transfer_rentals`, `transfer_public_transport` (migration `20260904140000`;
   `transfer_vehicles` excluded — no price column). Toggle + badge added to all 8 sheets/cards.
   `buildBusinessExpenseReport` generalized to merge all 5 sources with real currency conversion
   (`mergeCostItemsForReport` — a business-flagged transfer can now be in a different currency
   than the trip, which the old expenses-only report never had to handle). `hasBusinessExpenses`
   renamed `hasBusinessCosts`, now checks all 5 tables.

5. **Trip Overview cost summary.** New RPC `get_trip_cost_summary` (migration `20260905100000`,
   deliberately "dumb" — filtering only) + pure `computeTripCostSummary`
   (`packages/utils/src/costSummary.ts`, 20 tests) doing category-level precedence (an entity's
   own price wins over the matching expense category when `> 0` — NOT a per-row
   `expenses.related_id` link, since that column is never actually populated by the UI today;
   judged out of proportion to build real linking for this ask) and currency conversion. New
   "Trip costs" card on the Overview tab: group total, "≈ X per person (of Y budget)" line,
   clamped progress bar.

6. **Balances donut chart.** Arc/angle math extracted to pure `computeDonutArcs`
   (`packages/utils/src/donutChart.ts`, 12 tests). Grand total now in the center (from raw
   amounts, never reconstructed from rounded %s). In-slice % labels on slices ≥8% share, reading
   the exact same `percent` field the legend uses. Yellow ("shopping") category gets a dark label
   instead of white for contrast — **flagged for visual confirmation in the 4-theme QA pass, not
   yet done**.

7. **Global Analytics tab.** New RPC `get_my_trip_cost_shares` (migration `20260905110000`) + pure
   `computeMyCostShares` (36 tests) — "my share" is NOT `amount/memberCount` uniformly: a flight
   only counts if the user is an assigned passenger on THAT flight (else 0), expenses use the
   existing `expense_splits.amount_owed` debt figure directly, everything else
   (Base/Rentals/Public Transport/Activities) is an even split. New tab `app/(tabs)/costs.tsx`,
   feature folder `costsOverview` (name deliberately avoids `analytics` — already the PostHog
   telemetry module's name). Year sections: single year expands by default, multiple years expand
   only the current calendar year; a refetch never re-collapses a section the user already
   opened.

8. **Expense document camera capture, in create/edit/existing.** New
   `pickDocumentFromCamera()` (reuses `expo-image-picker`, already installed — no new native dep).
   `ExpenseDocumentsSection` gets a Camera button alongside Upload. `EditExpenseSheet` now embeds
   that section (had none before). `CreateExpenseSheet` gets a new `StagedDocumentsField` — files
   are held in local state (no `expenseId` exists yet) and uploaded via the create mutation's
   per-call `onSuccess` once the real id exists. **Known accepted gap** (matches every other
   document/avatar upload's "deliberately not persisted" status): if the create mutation is
   queued offline and the app is killed before it replays, staged files are lost.

9. **Web Push Notifications (Phase 12).** Fully built per the pre-existing spec in
   `engineering/implementation_guide.md` (now checked off). New `web_push_subscriptions` table +
   2 RPCs (migration `20260905120000`). `apps/mobile/public/sw.js` (plain ES5 — `resolvePath()`
   is a hand-ported mirror of `resolveNotificationPath.ts`, kept in sync manually). Client
   registration wired into `AuthGate`/`useSignOut`. **Real bug found and fixed in the existing
   Edge Function while wiring this in**: both `handleSingle` and `handleBatch` had an early
   `reason: 'no_tokens'` return whenever the recipient had zero Expo tokens — which would have
   silently skipped web push entirely for a user with ONLY a browser subscription (no native app
   installed). Removed the early return so web push always attempts, regardless of the
   Expo-token outcome. Edge Function redeployed to dev+prod. VAPID keys generated and set by the
   Tech Lead (dev+prod secrets, Vercel env var, local `.env`) — subject used
   `https://vacationist.app` (valid per RFC 8292, not just `mailto:`). `vercel.json` updated
   (sw.js rewrite before the SPA catch-all + no-store header). Privacy policy updated (EN html +
   DE markdown source, site rebuilt, confirmed stable on a 2nd build run). **End-to-end delivery
   CONFIRMED WORKING 2026-09-05** — see the VAPID secret fix below; was broken until then.

## Outstanding before this can ship

- Physical-device clean uninstall+reinstall test for the quick-action icon fix (item 2).
- Physical-device test (Android + iOS) for the trip calendar "dates band" fix (item 1, second
  fix) — change an existing trip's start/end year and check both the per-trip Calendar tab's day
  strip and the global Calendar tab's month-grid dots for the true last day. This bug's whole
  premise is that the local test suite (Node/V8) cannot catch it — see
  [[hermes-intl-timezone-gap]] — so passing tests alone doesn't confirm this one. While there,
  also spot-check the "today" ring in the per-trip Calendar tab on native, since
  `formatCalendarDayHeader`'s `isToday` still has a real (unfixed, untested) timezone dependency
  that could be a residual instance of the same engine gap.
- Nothing committed — awaiting the user's testing + explicit go-ahead.
- `app.config.ts` was already at `version: '1.34.0'` before this session started (uncommitted
  carry-over) — matches this release, no further bump needed.

## Visual QA + `/code-review` follow-up pass (2026-09-05)

Partial 4-theme (dark/light/colorful) `claude-in-chrome` pass confirmed: Analytics tab, donut
chart (center total + in-slice %), Trip Overview cost card (with/without budget), transfer
currency dropdown, business-expense toggle. Not explicitly re-checked after these fixes: System
theme spot-check, "shopping" (yellow) donut label (no test data with that category yet).

Four user-reported issues fixed after that pass:
- **Analytics tab full-bleed on web** — `apps/mobile/app/(tabs)/costs.tsx`'s `ScrollView` now caps
  at `maxWidth: 960, alignSelf: 'center'` on web, matching the trip chat's reading width
  (`chat.tsx`'s existing `maxWidth: 960` convention) instead of stretching full desktop width.
- **Donut in-slice % label looked tighter in colorful mode** — root cause was NOT the `fontSize`
  prop (fixed `11` everywhere); `global.css`'s `--font-family-base` is `Nunito-Regular` in colorful
  mode vs. `system-ui, -apple-system, sans-serif` in dark/light, and on web an SVG `<text>` inherits
  `font-family` from the CSS cascade — so the label silently rendered in a wider face only in
  colorful mode at the same pixel size. Fixed by pinning `fontFamily` explicitly on the `SvgText`
  in `ExpenseCategoryChart.tsx` so it's theme-independent. **Generalizable lesson: any `SvgText` in
  this app can silently inherit the ambient theme's font-family on web — pin it explicitly
  whenever exact sizing/fit matters.**
- **Trip Overview budget + cost summary now share one row** — both cards wrapped in a single
  `flex-row gap-sm`, each `flex-1`, matching the existing Days/Members stat row. Either can still
  render alone (budget unset, or costSummary still loading) and fills the row solo.
- Confirmed (no change needed): the budget progress bar already clamps its fill width to 100% via
  `computeBudgetProgress`'s `clampedPercent` while showing the unclamped `percent` as text (e.g.
  "134%") and turning `colors.danger` past 100% — exactly the intended over-budget behavior.

A `/code-review` pass on the full uncommitted diff against the 12-item task list then found:
- **Fixed:** per-entity transfer currency logic (item 12) was copy-pasted across all 6 Flight/
  Rental/Public Transport create+edit sheets — extracted into
  `apps/mobile/src/features/currencies/hooks/useTransferCurrencyField.ts` (+
  `initialTransferCurrency()`) and a shared `TransferCurrencyField` component, so the fallback
  chain and last-used-currency persistence rule can't drift between sheets again.
- **Fixed:** CLAUDE.md's First-Launch Tutorial rule was missed for the new Analytics tab (a major
  feature) — slide 4 (`slide4.title`/`slide4.description`, en+de) now mentions Expenses camera
  upload + the Analytics tab; `useTutorialSeen.ts`'s MMKV key bumped `tutorial_seen_v4` →
  `tutorial_seen_v5` so existing users see it once.
- **Skipped, by Tech Lead call:** updating `create-example-trip`'s demo trip to flag a Base/
  Transfer item `is_business` — judged as a new column on an existing entity type, not a new
  entity type, so CLAUDE.md's "Example Trip" rule doesn't strictly apply here.
- No other violations found (realtime filters, state boundary, no-`any`, Pro gating, i18n parity,
  migration immutability all clean); calendar end-date fix and quick-action shortcut-id bump both
  independently confirmed correct on inspection.

`npm run typecheck` and `npm test` (root, all 3 workspaces) green after every fix in this pass.

## Second `/code-review` pass — deeper multi-agent review (2026-09-05)

A second, more thorough `/code-review` (8 review angles, ~90 files) against the full uncommitted
diff found 10 more findings, all independently verified by reading the actual source before
fixing (not taken on the review's word alone). Fixed:

- **`create-example-trip` NOT NULL crash (critical):** migration `20260904130000` made
  `transfer_flights`/`transfer_rentals`/`transfer_public_transport.currency` `NOT NULL` with no
  default, but the demo-trip seeder's inserts for all three never set it. Every new signup's demo
  trip would fail those 3 inserts (silently — `logIfError` swallows it, the same pattern that
  hid the `trip_messages` gap once before). Fixed by adding `currency: 'EUR'` to all 3 inserts
  (matches the seeded trip's own `base_currency: 'EUR'`).
- **Business export flight amount — REVERTED (2026-09-05, later same day).** The second
  code-review pass (this entry, originally) added passenger-count multiplication to a
  business-flagged flight's amount, reasoning it should match `get_trip_cost_summary`'s RPC. That
  turned out to be the wrong model for THIS export specifically, found via a real Tech Lead test:
  a business flight with no passengers assigned reported €0.00 even though it had a real price,
  because passenger assignment is an independent, often-skipped logistics step, not a precondition
  for a cost having actually been incurred. Worse, for a flight shared with non-business
  co-travelers, multiplying by total assigned-passenger count would have overstated the business
  cost by folding in tickets nobody is expensing. **Reverted to using `f.price_per_person` as-is**
  — matching how accommodations/rentals/public-transport already report their own `price_total`
  directly, with no per-person math. The RPC-based multiplication in `get_trip_cost_summary`
  itself is correct and untouched — that one genuinely represents group/individual cost-SHARE
  math (Trip Overview total, "my share" in Analytics), a different concept from "what did this
  one flagged item cost for reimbursement." **Lesson: matching an existing RPC's formula for
  'consistency' is only correct when the two call sites actually mean the same thing — check the
  semantic purpose, not just the field name, before reusing a computation.**
- **Business export report currency — real bug fixed 2026-09-05 (later same day):** the report
  currency (`currencyCode`) was always `trip.base_currency`, never the member's own preferred
  currency, and the Tech Lead asked for `user.preferred_currency ?? trip.base_currency` (same
  fallback the Trip Overview cost card and Analytics tab already use). Making that change on its
  own would have introduced a **second, worse bug**: `expenses.converted_amount` is always frozen
  in `trip.base_currency` at write time (regardless of what the member actually paid), so an
  expense's row was being tagged `currency: currencyCode` — harmless before, since `currencyCode`
  always equaled `trip.base_currency` anyway, but silently wrong the instant the two diverge (the
  Tech Lead's own example: preferred=EUR, trip base=BAM — an expense's real BAM amount would've
  been tagged as if it were already EUR, skipping conversion entirely and producing a confidently
  wrong total). Fixed by splitting the single `currencyCode` into two variables: `reportCurrency`
  (`user.preferred_currency ?? trip.base_currency`, used for `mergeCostItemsForReport`/
  `buildBusinessExpenseReport`/the PDF payload) and `expenseCurrency` (`trip.base_currency`
  specifically, used only when tagging an expense's own `BusinessCostItem.currency` — accommodations/
  flights/rentals/public-transport already correctly used their own `.currency` field and needed
  no change). `mergeCostItemsForReport`'s existing per-item conversion-into-`reportCurrency` logic
  required no changes — it was already generic over each item's own currency; the bug was purely
  in what currency value the caller was ATTACHING to an expense item, not in the merge function
  itself. Currency is already shown at every number via the existing `formatCurrency` calls in
  `buildBusinessExpenseReport` (converted amount always shown; original-currency amount shown
  alongside in parens whenever it differs from `reportCurrency`) — no additional display change
  needed. **Lesson: a single shared "currency" variable is a landmine the moment a caller has more
  than one thing that could plausibly be `currency` (the report's target currency vs. a specific
  entity's own stored/frozen currency) — name them distinctly the moment there are two, rather
  than reusing one variable that happens to hold the same value by coincidence today.**
- **Business export PDF silently stripping the € symbol — real bug, found immediately after the
  currency-fallback fix above (2026-09-05, same day).** The Tech Lead reported "the business
  summary still does not contain a currency in the export" even after the report-currency fix.
  Root cause was NOT in any of the currency logic above — it was in
  `supabase/functions/render-business-expense-pdf/index.ts`'s text sanitizer. pdf-lib's standard
  Helvetica font can only draw WinAnsi-encoded characters, and the sanitizer's `NON_WINANSI` regex
  (`[^\t\n\r\x20-\x7E¡-ÿ]/g`, i.e. ASCII + pure Latin-1 Supplement) modeled WinAnsi as if it were
  exactly Latin-1/ISO-8859-1 — but WinAnsi is actually Windows-1252, which replaces Latin-1's
  C1 control-character block (U+0080-U+009F) with real printable glyphs, including the Euro sign
  (€, U+20AC) at 0x80. Since U+20AC falls in neither allowed range, every `formatCurrency`-produced
  EUR string (`€45.30`) had its € silently stripped by this sanitizer before reaching `drawText()`,
  leaving a bare, currency-less number in the PDF — the exact symptom reported, and specifically a
  **PDF-only** bug: the client-side Markdown export was never affected (no sanitizer runs on that
  path), and CHF/USD/GBP/BAM all survive already (CHF/USD are ASCII, GBP's £ (U+00A3) is within
  the Latin-1 Supplement range, BAM has no dedicated symbol in `CURRENCY_SYMBOLS` so it falls back
  to the plain ASCII code) — EUR specifically was the one broken by this gap. Verified the actual
  fix (not just reasoned about it) by installing `pdf-lib@1.17.1` locally via npm and running a
  real `drawText()` call with '€45.30' against `StandardFonts.Helvetica` — confirmed it renders
  without throwing before deploying. Fixed by explicitly allowing € in the regex
  (`[^\t\n\r\x20-\x7E¡-ÿ€]/g`) rather than trying to re-derive the rest of the 0x80-0x9F block,
  since € is the only character from it this app's currency symbols or general report text
  actually needs. Redeployed to dev + prod (this function had no prior deploy this session before
  this fix, so no separate "was it redeployed" gap here — see
  [[edge-function-redeploy-after-edit]] for why that check matters anyway). **Lesson: a
  "sanitize to a safe character range" allowlist is only as good as the caller's understanding of
  what that range actually contains — "WinAnsi ≈ Latin-1" is a common, wrong mental model; verify
  the actual encoding's character set (or just test the specific characters your app's data
  actually produces) rather than assuming a familiar-sounding related encoding is identical.**
- **Business export missing committed-status filter:** the export filtered only on `is_business`,
  with no status check — a still-voting ('suggested'/'requested') accommodation or flight flagged
  business would appear in an employer-facing report before it was ever actually booked/paid for.
  Fixed by filtering accommodations to `reserved`/`booked`/`completed` and flights to
  `booked`/`completed`, matching the RPC's own committed-only semantics (rentals/public transport
  have no status lifecycle, so unaffected).
- **Trip Overview budget-vs-cost currency mismatch:** `computeBudgetProgress` compared
  `costSummary.total` (converted into the member's preferred currency) against
  `trip.budget_per_person` (always `trip.base_currency`, never converted) — wrong percent/progress
  whenever those two currencies differ. Fixed by converting `budget_per_person` into the same
  display currency first via `useCurrencyConversion()`, falling back to no budget comparison
  (not a wrong one) if the rate is unavailable.
- **Donut chart percentages not summing to 100:** each slice's `%` was rounded independently
  (`Math.round`), so e.g. three equal-thirds categories showed 33/33/33 = 99% on screen (visible
  since this batch added the in-slice labels). Fixed `computeDonutArcs` with largest-remainder
  rounding (floor every share, hand the leftover whole points to the largest fractional
  remainders) — 2 new tests added (equal-thirds, equal-sevenths) asserting the displayed set
  always sums to exactly 100.
- **Web push unregister/sign-out race:** `useSignOut.ts` fired `unregisterWebPushAsync()` and
  `signOut()` as two independent fire-and-forget calls; `signOut()` clears the local Supabase
  session almost immediately, so on a slower device `delete_web_push_subscription`'s
  `auth.uid()` check could already see no session by the time it ran, leaving the subscription row
  behind (real risk on a shared/kiosk browser switching accounts). Fixed by chaining
  `signOut()` after `unregisterWebPushAsync()` resolves (`.finally`), while `reset()` etc. still
  run immediately so sign-out still feels instant.
- **VAPID module-level crash risk:** `webPush.setVapidDetails()` ran unguarded at module scope in
  the push-notification Edge Function — a malformed `VAPID_SUBJECT`/key (future rotation typo)
  would throw synchronously on cold start and crash the ENTIRE function, taking the pre-existing
  Expo push pipeline down with it. Wrapped in try/catch; a bad VAPID config now just disables web
  push for that invocation instead of killing everything.
- **`hasBusinessCosts` missing `deleted_at` filter:** `transfer_flights`/`transfer_rentals`/
  `transfer_public_transport` had `deleted_at IS NULL` deliberately removed from their SELECT RLS
  (`20260522000008_transfer_realtime_softdelete_rls.sql`) specifically so every explicit API-layer
  query would add it back — this count query didn't, so a soft-deleted business-flagged transfer
  kept the "Generate Business Summary" button enabled while the actual export (which does filter
  it) found nothing, producing an empty-report error. Fixed by adding `.is('deleted_at', null)`
  for those 3 tables (`accommodations`/`expenses` don't need it — their RLS still filters
  server-side).
- **Exchange-rate race in both cost-summary hooks:** `useTripCostSummary`/`useMyTripCostShares`
  computed their result as soon as the RPC rows resolved, without waiting for
  `useExchangeRates()` — on a cold cache, rows can resolve before rates, briefly running the
  currency-conversion pass against an empty rate map (understated total, spurious "rates
  excluded" note) before self-correcting on the next render. Fixed by having both hooks also
  override `isPending` (not just `isLoading`) to include the rates query, so
  `getQueryDisplayState` (Analytics tab) and an explicit `!costSummaryLoading` check (Trip
  Overview) both wait for both queries before rendering.

**Deliberately not fixed — open scope question, not resolved this session:** the original task
list's item 12 says "...keep flights, bases, etc. as they are (based on the new proposed
dropdown)," which read literally would mean accommodations ("Base") should get the same
persistent-currency treatment as Flights/Rentals/Public Transport. But the original `/plan`
clarification round explicitly scoped item 12 to "priced types only" (Flights/Rentals/Public
Transport) and explicitly decided accommodations get NO currency column this round (see the
"Done" section, item 3 above) — a real, already-negotiated scope line, not an oversight. Whether
to extend accommodations to the same per-entity currency + dropdown mechanism is a Tech Lead call,
not something to silently expand mid-review.

`npm run typecheck` and full `npm test` green after this pass too.

## Deployment audit (2026-09-05, triggered by the Tech Lead asking "did you deploy everything?")

Checking `supabase functions list`'s real `updated_at` timestamps against each Edge Function's
edit history (rather than trusting this file's own "redeployed" notes above) found one real gap:
`push-notification`'s VAPID `try/catch` fix (from the second `/code-review` pass, above) was never
actually redeployed after that edit — the function's last live deploy predated it. Fixed by
redeploying `push-notification` and (for certainty) `create-example-trip` to both dev and prod;
migration ledger parity reconfirmed on both. See [[edge-function-redeploy-after-edit]] for the
general lesson this produced. All migrations for this entire batch (12 items + the accommodation
extension) and all touched Edge Functions are now confirmed live on dev and prod as of this audit.

## End-to-end web push test found a real bug: malformed VAPID_PUBLIC_KEY secret (2026-09-05)

The Tech Lead's first real end-to-end test (two localhost browsers, dev) surfaced the exact
symptom the "known accepted gap" in item 1 above didn't anticipate: chat messages correctly
created `notifications` rows, the per-minute `dispatch-pending-push-notifications` cron correctly
called the Edge Function, `push_sent_at` was correctly set on both rows — but no OS/browser push
notification ever appeared, only the unrelated in-app realtime toast (`useNotificationsRealtime`,
fires independently of push entirely).

Root cause, found via the actual Edge Function log line (Tech Lead pulled it from the dashboard
after a Supabase MCP OAuth attempt failed): `Invalid VAPID configuration — ... Vapid public key
should be 65 bytes long when decoded.` — the try/catch added in the earlier code-review pass (see
above) was correctly catching this and disabling web push for the invocation, exactly as
designed, but that meant every push silently no-op'd from `sendWebPushToUsers`'s very first line
(`if (!webPushConfigured...) return;`) with zero further signal.

Verified the CLIENT'S key first (`EXPO_PUBLIC_VAPID_PUBLIC_KEY`, from `.env`/`.env.development`)
was NOT the problem — base64url-decoded it locally, confirmed exactly 65 bytes with the correct
`0x04` uncompressed-EC-point prefix. That meant the mistake was specifically in how the Supabase
`VAPID_PUBLIC_KEY` secret was originally entered (most likely a copy-paste error during the
Tech Lead's original `web-push generate-vapid-keys` → `supabase secrets set` step). Since the
server's `VAPID_PUBLIC_KEY` must be byte-for-byte identical to whatever public key the browser
used to create its subscription (it's cryptographically bound in), the fix was unambiguous, not a
guess: `supabase secrets set VAPID_PUBLIC_KEY=<the confirmed-valid client value>` on **both** dev
and prod (Tech Lead confirmed Vercel's client-side key for prod is the same single key pair used
everywhere), followed by a redeploy of `push-notification` on both — a secret change alone isn't
guaranteed to take effect on an already-warm Edge Function instance since VAPID setup runs at
module-init time, not per-request.

**CONFIRMED WORKING (2026-09-05, same day):** the Tech Lead retested on dev/localhost after the
fix — web push now arrives correctly. This also confirms `VAPID_PRIVATE_KEY` genuinely is the key
paired with this public key (a mismatch there would have surfaced as a 401/403 from FCM/Mozilla
instead of success), so no further VAPID regeneration is needed. Dev is fully verified end-to-end;
prod got the identical fix (same confirmed key, redeployed) but has not itself been end-to-end
tested with a real device against `web.vacationist.app` — reasonable to treat as working by the
same fix, but a real prod test would remove the last bit of doubt.

**Lesson:** the try/catch added for "don't crash the whole function on bad VAPID config" was the
right call (prevents a config typo from taking down the pre-existing Expo push pipeline too), but
it also means a broken VAPID secret is now a *silent, total* web-push outage with a single log
line as the only signal — there is no user-facing or client-side symptom that distinguishes "web
push is silently disabled" from "web push is working but nothing happened to trigger it." Only an
actual end-to-end test (send a message, watch for the OS notification, check logs if it's missing)
can catch this class of bug — code review and local typecheck/tests cannot.

Related: [[v1-33-0-batch]] (previous release), [[android-runtime-resource-shrinking]],
[[edge-function-redeploy-after-edit]], [[commit-discipline]], [[no-docker-on-machine]] (why
Deno/pgTAP aren't locally testable — the Edge Function deploy itself is the syntax/type check).
