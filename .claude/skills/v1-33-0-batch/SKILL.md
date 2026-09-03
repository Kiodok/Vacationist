---
name: v1-33-0-batch
description: Progress tracker for the v1.33.0 / v1.33.1 release — the original 19-item batch (12 groups), a 3-item addendum, a 10-finding code-review pass, two device-testing rounds, and the v1.33.1 quick-action follow-ups (Android shortcut icon robot glyph — raster PNG + keep.xml; resolveActiveTrip next-planned-trip tier), all code-complete, nothing committed yet, pending EAS build + device testing before release. Use to resume work or answer "what's the status of v1.33.x" — lists every group's implementation details and key decisions already made so they aren't re-litigated.
---

# v1.33.0 batch progress

Implementation is complete for all three phases of v1.33.0 (original 19-item batch, the 3-item
addendum, and the 10-finding code-review fix pass below). The plan file at
`C:\Users\Gary\.claude\plans\optimized-munching-snowglobe.md` is overwritten with each new planning
pass (per this repo's plan-mode convention of starting fresh for a different task) — it currently
holds the code-review fix plan, not the original 19-task plan; this skill file is the durable
record of everything done across all three passes. Nothing has been committed yet — user tests on
device first, per [[commit-discipline]].

**Why this matters:** it's the current release cycle; the user is actively testing each group live
on an Android dev-client build as it lands, so groups ship one at a time with typecheck/test/
migration verification between them, not as one big-bang PR.

## Done (12 of 12 groups — batch code-complete)

1. **Foundation — category dropdowns (task 1).** New `apps/mobile/src/components/OptionPickerSheet.tsx`
   (generic select-and-close sheet, modeled on `CurrencyPickerSheet`). Replaced chip rows with
   dropdowns for: activity category (Create+Edit), expense category (Create+Edit), private
   packing-list category (Create+Edit, including the "custom category" inline-text-input flow),
   and expense "paid by" (Create+Edit) — the last two were added at explicit user request, beyond
   the original plan scope. Shared packing list has no category field (just a 3-way item-type
   toggle) — nothing to convert there.

2. **Expense enhancements (tasks 2, 6, 7).** New `expenses.description` column + RPC params
   (migration `20260901100000`). Category now editable in Edit sheet (same migration). Fixed a
   real bug in the cover→multi-person split flow: `EditExpenseSheet.tsx`'s
   `handleSplitMethodChange` was defaulting `paid_by` to `expense.paid_by` when leaving cover
   mode, but for a cover expense that field holds the *covered* person, not the actual payer —
   now defaults to `coverActualPayer`. Tech Lead decision: mutate the expense in place, no
   duplicate/history row.

3. **Documents (tasks 8, 15).** Private Storage buckets `expense-documents` /
   `transfer-documents` (multiple docs per expense; one ticket per flight+passenger via
   `UNIQUE(flight_id, user_id)` + upsert-replace). New `packages/api/src/documentStorage.ts`
   shared helper, `expenseDocuments.ts` / `transferDocuments.ts`, non-persisted hooks,
   `ExpenseDocumentsSection.tsx` (in the expense card detail) and `FlightTicketsSection.tsx` (in
   the flight card's passenger list — deliberately shows **all trip members**, not just
   assigned passengers, since ticket upload shouldn't require booking+passenger-assignment first).
   Added `expo-document-picker`. Two follow-up bugs the user caught and had fixed:
   - `Alert.alert()` is a **hard no-op on react-native-web** (`react-native-web`'s Alert is
     literally `static alert() {}`) — any destructive-confirm built on it silently does nothing on
     web. Both document sections now use an inline per-row Cancel/Delete confirm instead (matches
     the rest of the app's dominant pattern, e.g. `settings.tsx`). **Watch for this same bug
     anywhere else `Alert.alert` is used for a confirm with custom buttons** — `TravelDocumentCard.tsx`,
     `NudgeSheet.tsx`, `BiometricGate.tsx` all use it and haven't been audited for the same issue.
   - Flight ticket upload only rendered after `flight.status === 'booked'` + passengers assigned —
     removed that gate; ticket section is now always visible, listing every trip member.
   - A download button (next to view/delete) was added then **removed again for flight tickets
     only** at user request — the view/open button already triggers a download on their platform,
     so a separate download button was redundant there. `ExpenseDocumentsSection` still has both
     view and download buttons (never flagged as redundant for that surface).
   - Added `downloadRemoteFile()` to `apps/mobile/src/utils/share.ts` (web: blob + `<a download>`;
     native: `FileSystem.downloadAsync` + `shareFile`).
   - Required per CLAUDE.md: `delete_own_account()` reassignment logic added for both new tables'
     non-cascading FKs (migration `20260901120000`), plus EN/DE delete-account disclosure pages
     updated and `marketing/site` rebuilt.

4. **Balances & Settlements redesign (tasks 4, 5, 9).** New RPC
   `get_trip_expense_category_totals` (migration `20260901130000`). New
   `ExpenseCategoryChart.tsx` (donut, `react-native-svg`) — palette chosen via the `dataviz`
   skill's actual validator script, not eyeballed; fixed 5-hue category→color assignment
   (blue/orange/aqua/yellow/magenta for accommodation/activity/transport/shopping/manual),
   validated for a donut's *circular* adjacency including the wrap-around last→first pair (the
   validator's default "adjacent" pairlist is linear and doesn't check that pair — checked it by
   hand). `SettlementsModal.tsx` reordered: **your-balance card (new) → Simplified Settlements →
   category chart (new) → collapsible "Bank Balance Reality" (renamed from "Member Balances",
   collapsed by default) → Transaction History**. Title was originally "What to expect on your
   bank account" / "Was auf dein Konto zukommt" — shortened after user feedback (too long for
   narrow screens) to **"Bank Balance Reality" / "Kontostand-Realität"**. Fixed a real console
   warning along the way: `react-native-svg`'s web adapter turns the `rotation`/`origin` shorthand
   props into a raw `transform-origin` key, which React flags — use the plain SVG
   `transform="rotate(...)"` string instead, always, on this component and any future one.
   **Not done yet:** full four-theme (dark/light/colorful/system) browser visual pass on this
   modal — flagged, not verified, no test account/session available to drive it.

5. **Transfer: Public Transport segment (task 17).** New `transfer_public_transport` table
   (byte-for-byte `transfer_rentals`' shape, transit fields swapped in), 4th segment in
   `TransferSegmentedControl` + `transfer.tsx`. Reused the `transfer_documents` table/bucket from
   flight tickets (task 15) rather than a parallel table — added a nullable `public_transport_id`
   FK, made `flight_id` nullable, `CHECK` for exactly-one-parent, second `UNIQUE(public_transport_id,
   user_id)` constraint. `PublicTransportTicketsSection.tsx` mirrors the already-bug-fixed
   `FlightTicketsSection.tsx` (inline confirm, no download button) but is available to **every**
   trip member — public transport has no passenger-assignment concept to gate on at all. Seed row
   added to `create-example-trip` (redeployed to dev+prod).

6. **Business/company expense flag + summary (task 18).** `expenses.is_business` column +
   `Switch` toggle in both expense sheets + briefcase badge on `ExpenseCard`. Summary is
   generated via a one-off `getAllExpenses()` call inside the button handler — deliberately
   **not** a mounted reactive query (`useAllExpenses` exists but the screen doesn't call it),
   so opening the Expenses tab never pays for a whole-trip fetch it doesn't need.
   User follow-up feedback after first ship, both addressed same day:
   - "Copy to clipboard isn't enough" → `formatBusinessExpenseSummary` now emits real Markdown
     (a GFM table, not emoji plain-text) and the handler always produces a real `.md` file —
     `downloadTextFile` on web, `FileSystem.writeAsStringAsync` + `shareFile` (falls back to
     `shareText`) on native — mirroring `useTripExport.ts`'s exact export pattern. Plain
     clipboard-copy is gone entirely for this feature.
   - "Only show the button if at least one expense is business" → button visibility is gated by
     a **new cheap existence check**, `hasBusinessExpenses(tripId)` (`packages/api/src/expenses.ts`,
     a `head: true, count: 'exact'` query — no row fetch) via `useHasBusinessExpenses` hook
     (`staleTime: 60_000`, nested under `['trips', tripId, 'expenses']` so it auto-invalidates on
     any expense mutation). Deliberately **not** `useAllExpenses` or the paginated feed — both
     would either defeat the "no eager whole-trip fetch" decision or be pagination-incomplete.
   - "Markdown should include the documents" → the handler now also fetches each business
     expense's `expense_documents` (via `getExpenseDocuments`) and mints a **long-lived signed
     URL** per document (`getExpenseDocumentUrl(path, ttlSeconds)` — `ttlSeconds` is a new
     optional param on `getSignedDocumentUrl`/`getExpenseDocumentUrl`, default stays the existing
     5-minute in-app-viewing TTL). Rationale: a downloaded report handed to an employer may be
     opened well after the in-app 5-minute default would have expired. Rendered as
     `[filename](url)` links in the table's Documents column, `<br>`-joined for multiple docs per
     row, `—` when none. TTL bumped **7 → 30 days** on further request
     (`BUSINESS_SUMMARY_DOCUMENT_URL_TTL_SECONDS` in `expenses.tsx`).
   - "Make sure a just-flagged-business expense is included right away (save → export within
     seconds)" → the raw `getAllExpenses()`/document fetches were already always live (no
     client-side caching to go stale — a completed RPC call is a committed Postgres transaction,
     so any immediately-following SELECT already sees it). The actual gap was the **button's
     visibility flag**, which previously relied on `mutationDefaults.ts`'s post-success
     invalidate+refetch of `has-business` — correct eventually, but a second network round trip
     after the save's own round trip. Fixed by adding `onMutate` to `useCreateExpense` and
     `useUpdateExpenseWithSplits` (`useExpenses.ts`) that optimistically
     `queryClient.setQueryData(['trips', tripId, 'expenses', 'has-business'], true)` the instant
     `input.is_business` is true — zero network wait for the button to appear. Deliberately
     **one-directional** (only ever sets `true`, never `false`, on this optimistic path) since
     unsetting one expense's flag doesn't mean no other business expense exists; the real
     invalidate+refetch in `mutationDefaults.ts` remains the source of truth for hiding the
     button and for offline-queued-mutation replay (which runs without the hook's `onMutate`).

7. **Participant-removal confirmation polish (task 3).** The per-row inline Cancel/Remove confirm
   in `settings.tsx` showed no explanatory text — fixed by swapping the role-label line for
   `t('settings.removeMemberConfirm', { name })` (`text-danger`) while pending, reusing the
   existing "name + secondary line" slot rather than adding a new line, so row height in the
   virtualized (20+ members) `BoundedVirtualList` path is unaffected — below the 20-member
   threshold (the overwhelming majority of trips) the list renders as a plain unbounded `.map()`
   anyway, so height changes there are always safe regardless. New key `settings.removeMemberConfirm`
   (en+de, `{{name}}` interpolated), matching the existing `settings.leaveConfirm`/`deleteConfirm`
   naming convention in `trips.json`.
   Also fixed two pre-existing hardcoded-English toast bugs found while touching
   `useMembers.ts` (not introduced this session, per CLAUDE.md's "fix and explain" rule):
   `useRemoveMember` ("Member removed" / "Failed to remove member.") and `useLeaveTrip`
   ("You left the trip" / "Failed to leave trip.") were plain JS strings, inconsistent with every
   other mutation in the app (`useDeleteTrip` right next to them already used
   `i18n.t('trips:toast.deleted')` etc.). Both now use `i18n.t(...)` with new/existing keys
   (`toast.memberRemoved`, `toast.removeMemberFailed`, `toast.left` new; `toast.leaveFailed`
   already existed but was unused by `useLeaveTrip`'s own error path until now).

8. **Chat draft persistence across tabs (task 10).** New in-memory-only Zustand store
   `apps/mobile/src/stores/chatDraftStore.ts` (`draftsByTripId: Record<tripId, text>` +
   `setDraft`/`clearDraft`) — no MMKV persistence, since the ask was only "switching tabs within
   the app doesn't lose the draft," not surviving an app kill, and no other misc-UI Zustand store
   in this codebase (`toastStore`, `themeStore`, `captchaFallbackStore`, `consentStore`) is reset
   on logout either, so `chatDraftStore` doesn't add a new precedent there. `ChatInputBar.tsx`
   gained a required `tripId` prop (only call site, `chat.tsx`, updated); its `text` local state
   is now **lazy-seeded once from the store at mount** (`useState(() =>
   useChatDraftStore.getState().draftsByTripId[tripId] ?? '')`, a non-reactive one-time read, not
   a live subscription) rather than fully store-controlled — this exactly matches the actual need
   since the component fully remounts on every virtual-tab switch
   (`app/trip/[id]/index.tsx`'s tab switch unmounts the inactive tab), so lazy-init-on-mount is
   the natural restore point. Every keystroke also writes through to `setDraft(tripId, value)`;
   sending a message calls `clearDraft(tripId)`. Deliberately **does not** touch the draft store
   while `editingMessage` is set — editing an existing message is a separate, ephemeral overlay
   that shouldn't clobber whatever the user was mid-composing before tapping Edit; canceling an
   edit still clears back to `''` exactly like before this change (task 10 only asked for
   compose-draft persistence, not edit-draft persistence).
   **Regression found and fixed same day** (user report: "Does not work on Web at all" — verified
   live via `claude-in-chrome` against the user's already-running `localhost:8081` dev server,
   not a fresh `npm run web`, since port 8081 was already taken): the pre-existing
   `useEffect(() => { if (editingMessage) {...} else { setText(''); } }, [editingMessage?.id])`
   also fires on the component's very first mount (effects always run after the initial render,
   regardless of deps), and since `editingMessage` starts `null`, it immediately hit the `else`
   branch and wiped the just-restored draft a tick after mount — on **every** platform, not
   actually web-specific, it just happened to be caught on web first. Fixed with a
   `prevEditingIdRef` that distinguishes "just mounted, never editing" from "was editing,
   now cancelled/saved" — both look like `editingMessage === null`, but only the latter should
   clear text. Verified live: typed a draft, switched to another tab and back, draft survived;
   sent it, input cleared and `clearDraft` fired correctly. **Lesson for future work on this
   component:** any effect keyed on a prop/state that is `null`/falsy at first mount needs an
   explicit "is this the initial mount" guard if the `else` branch has a side effect that should
   only run on a real transition, not on mount — lazy `useState` initializers are not protection
   against a same-render-cycle `useEffect` overwriting them.

9. **Notify organizer on document-access grant (task 11).** New migration `20260901160000` —
   `document_access_granted` added to `notifications_type_check` (16th value) + a new
   `AFTER INSERT ON document_access_grants` trigger. Direct single-recipient `INSERT` into
   `notifications` (not `create_trip_notification()`, which only supports "everyone except one
   user") — mirrors the existing `notify_lost_found_target_user_changed` pattern, per the plan.
   Only fires on an actual grant (`NEW.granted`), silent on denial by design. Populated
   `context_trip`/`context_creator` on the row (its sibling `notify_document_access_request`
   doesn't), so this type is properly locale-translated client + push side — **flagged, not
   fixed:** `notify_document_access_request`'s body has the same "no context, no template" gap
   and always renders in English regardless of device locale; left alone as a separate
   pre-existing issue outside this task's scope, noted in `engineering/supabase.md`.
   App layer: `NOTIFICATION_TYPE` enum, edge function `NOTIFICATION_TRANSLATIONS` (en+de) +
   `preferenceColumn` case (`null`, always-on), `NotificationItem.tsx` `BODY_TEMPLATES` entry,
   `NOTIFICATION_ICON_COLORS` entry (`shield-checkmark-outline`, same indigo as the sibling
   request type), `type.document_access_granted` i18n key (en+de). `resolveNotificationPath.ts`
   routes it to `/trip/${trip_id}?tab=Settings` (the organizer's "View Documents" destination) —
   deliberately different from `document_access_request`'s `/(tabs)/profile` route, since the two
   types' recipients differ (responding member vs. requesting organizer). Migration + edge
   function both deployed to dev then prod; ledger parity confirmed.

10. **Bug fixes 12/13/19.** Migration `20260901170000`: `get_trip_tab_content()` gains its own
    `calendar` flag (filtered to `activity_date IS NOT NULL`, matching `useCalendarActivities`) —
    Calendar no longer reuses the `activities` flag, fixing task 19's false "has content" border
    for trips with only date-less activities. `RETURNS TABLE` shape change needed an explicit
    `DROP FUNCTION` first (`CREATE OR REPLACE` can't alter return type). **Bonus fix folded into
    the same migration:** `transfer_public_transport` was never added to the `transfer` flag's OR
    chain despite that group's own plan calling for it — missed earlier this session, caught and
    fixed here since it's the same function.
    Task 12 fix applied per the plan: `ActivityCard.tsx`'s bare `dayjs(activity_date)` → `dayjs.tz(...,
    timezone)`, new required `timezone` prop threaded from `trip.timezone` via
    `ActivityCardWithVotes` in `activities.tsx`.
    **Correction to the plan's diagnosis, found while implementing** (see
    `engineering/supabase.md` for the full trace through dayjs's actual source): dayjs's parser
    does NOT parse a bare date-only string as UTC-then-local-shift the way native `Date` does —
    verified empirically (`process.env.TZ` forced negative-offset) and in
    `node_modules/dayjs/dayjs.min.js` directly. The task-12/13 "off by one" diagnosis for
    date-only strings doesn't actually reproduce; the `.tz()` fixes applied (`ActivityCard.tsx`,
    `GlobalCalendarTripSection.tsx`, `generateDateRange`/`formatDateRange` in `packages/utils`,
    `TripCard.tsx`'s duplicate `formatDateRange` now removed in favor of the shared one) are
    harmless/clearer-intent but weren't fixing an active bug for that specific case.
    **The real task-13 bug** ("Switzerland vs. the other country," hour-shift) is in
    TIMESTAMPTZ-based transfer fields (flight/rental/public-transport times) — PostgREST returns
    these with an explicit UTC offset (e.g. `+00:00`) that dayjs's safe local-parsing regex
    doesn't match, so it falls through to a *real* UTC-anchored native parse, and a bare
    `.format()` genuinely converts to device-local, shifting the shown hour. Found via
    `FlightCard.tsx`'s pre-existing correct pattern (manual regex digit-extraction) versus
    `PublicTransportCard.tsx` (added this session, bug) and `RentalCard.tsx`/
    `AllTransfersView.tsx`'s rental block (pre-existing bug) using a bare `dayjs(value).format(...)`
    instead. Consolidated all onto one new shared `formatNaiveTimestamp()` util
    (`packages/utils/src/format.ts`), removing three near-duplicate private helpers.
    New `packages/utils/src/calendar.test.ts` (4 tests, forces `TZ=America/Los_Angeles`).

11. **Web time-picker double clock icon (task 14) — took three attempts to actually land.**
    Final, user-confirmed-working fix in `DateTimePickerField.tsx`: for `mode === 'time'` on web,
    the real `<input type="time">` is rendered fully **transparent** (`opacity: 0`, absolutely
    positioned to fill its box) but still focusable/typable/clickable — `opacity` on the element
    itself is the one thing guaranteed to suppress 100% of its own rendering, native icon
    included, on every engine, since nothing can visually "leak through" the way it can past a
    separate covering layer. A purely presentational sibling `<div aria-hidden>` underneath
    renders the visible text (the value, or a literal `'--:--'` placeholder when empty) —
    `pointerEvents: 'none'` so clicks pass straight through to the real input. The pre-existing
    custom `ThemedIcon` button (unchanged) remains the only visible icon. Date mode is untouched
    (always was single-icon, never had this bug).
    **What didn't work, in order, and why it matters for next time:**
    1. `input[data-vacationist-time]::-webkit-calendar-picker-indicator{opacity:0;display:none;}`
       as a global rule in `+html.tsx`. Verified via `claude-in-chrome` (dev server + zoomed
       screenshots, both dark and light theme) showing exactly one icon — looked completely
       fixed. **User reported it still duplicated in Chrome, Edge, *and* Firefox.** Root cause:
       Firefox has no `-webkit-` equivalent hook at all (confirmed technical fact, not
       browser-specific quirk to work around later), so this could never have covered it there —
       and evidently Chrome/Edge weren't reliably covered either despite the passing local test
       (never fully explained; possibly a stale-server subtlety, but see attempt 2).
    2. An opaque same-background `<div>` absolutely positioned over the input's own right edge
       (input kept fully visible/opaque, only the assumed icon position masked). Also verified
       clean via the same live-browser process. **Also reported still duplicated** — the user
       pasted the actual rendered DOM proving the mask code *was* live and correctly styled, so
       the technique itself is what failed: evidently some browsers paint a native form control's
       own internal chrome above ordinary sibling DOM content regardless of normal stacking
       order, so a separate covering element can't reliably win against it.
    3. The opacity-on-the-real-input rewrite above — **user-confirmed fixed** ("Now its gone!").
    **Lesson:** for suppressing a native form control's own internal rendering (not just
    generic sibling content), don't trust CSS pseudo-element hooks or covering overlays even
    after a clean local verification — verification in one engine (this session's Chrome-only
    `claude-in-chrome`) passing does not mean the fix holds in the browsers that actually matter,
    and does not rule out the technique itself being fundamentally unreliable. `opacity` directly
    on the offending element is the one technique that's structurally guaranteed to work
    everywhere, because it isn't fighting the browser's own paint/stacking behavior at all.
    Removed the now-dead `data-vacationist-time` attribute and its `+html.tsx` CSS rule once the
    opacity approach made both moot. CSS/opacity-only change, no new color/theme surface, so no
    four-mode pass beyond the dark/light spot-check already done.

12. **App-icon quick action → Add Expense (task 16) — final group, batch now code-complete.**
    Added `expo-quick-actions@6.0.2` (new native dependency — this is what forces the full EAS
    build this release already needed anyway). Bare `'expo-quick-actions'` entry in
    `app.config.ts`'s plugins (no config props — static `iosActions`/`androidIcons` weren't used;
    everything is set at runtime since the target trip must be resolved fresh, never baked in).
    New `resolveActiveTrip(trips)` in `apps/mobile/src/features/trips/utils/` (6 unit tests) —
    there's no other "active trip" concept anywhere in the app, so this mirrors
    `getEffectiveStatus`'s own bucketing (`TripCard.tsx`): today (device-local date) within
    `start_date..end_date` among non-archived trips, soonest-`end_date` tiebreak, falls back to
    most-recently-created non-archived trip when none currently qualify.
    New hook `useAppIconQuickAction` (`apps/mobile/src/features/trips/hooks/`), mounted in
    `_layout.tsx`'s `AuthGate` gated on `hasSession && Platform.OS !== 'web'` (the library also
    ships a safe no-op web stub — `setItems`/`addListener` do nothing there — so the platform
    gate is for clarity, not correctness). Registers a single "Add Expense" shortcut via
    `QuickActions.setItems` on mount and on every app-foreground (reusing the existing
    `useAppForeground` utility), and re-registers whenever `useLocale()`'s reactive `locale`
    value changes so the shortcut's title stays translated without needing a relaunch. **The
    target trip id is deliberately never baked into the shortcut's own params** — `resolveActiveTrip`
    runs again, fresh against `queryClient.getQueryData(['trips'])`, only at the moment the
    action actually fires (`QuickActions.addListener`, plus a one-time check of
    `QuickActions.initial` for the true-cold-start case where launching the app *is* the tap, so
    no listener could have been attached yet) — a trip "active" when last registered may not
    still be by the time the user actually taps days later. Navigates via the same `?tab=`
    query-param convention as everywhere else in the app (`resolveNotificationPath.ts`), not a
    direct file-route, since `index.tsx` owns the tab bar/trip header chrome:
    `/trip/${id}?tab=Expenses&quickAction=addExpense`.
    `expenses.tsx` reads that `quickAction` param (lazy `useState` initializer, so it only fires
    once per mount even though the param persists in the URL) to auto-open `CreateExpenseSheet`
    and show a new `autoSelectedTripBanner` prop ("Adding to: {trip title}", new
    `expenses:quickAction.addingTo` i18n key) — per the plan's explicit requirement, the
    auto-selection is never silent. New `common:quickAction.addExpense` key is the shortcut's own
    translated label (read via the static `i18n.t(...)` at registration time, not a hook, since
    registration happens outside any component's render).
    **Not verified live** — this is a native-only feature (home-screen long-press) with no web
    equivalent and no local device/simulator/EAS access in this environment; the plan's own
    verification note says exactly this ("can't be verified via `npm run web`... build a
    preview/dev-client build and manually long-press the app icon on both a physical Android and
    iOS device"). `npm run typecheck` and `npm test` pass (156 mobile tests, +6 for
    `resolveActiveTrip`), but the actual shortcut registration/tap/navigation flow needs the
    Tech Lead's own device testing after the next EAS build.
    **Skipped, worth a discretionary call rather than assumed:** did not bump the tutorial
    (`tutorial.json`/`useTutorialSeen`'s versioned key) for this feature — a home-screen
    long-press isn't something an in-app tutorial slide can demonstrate (the user has to already
    be outside the app to discover it), so it didn't seem like a fit for that mechanism, but
    flagging the omission explicitly rather than silently deciding it doesn't apply.

## v1.33.0 batch: all 12 groups / 19 tasks code-complete

Every group above is implemented, `npm run typecheck` and `npm test` pass as of the last group.
Nothing has been git-committed this entire batch (per [[feedback_commits]] — user tests first).
Two items still need the Tech Lead's own verification before this ships, both native-only and
outside what this environment can test:
- Task 16 (this group) — the actual quick-action tap/navigation flow, physical device only.
- The full four-theme (dark/light/colorful/system) browser visual pass on the Balances &
  Settlements modal from group 4, flagged there as not done (no test session was available then).

Next steps are the standard release pipeline (`engineering/software_engineering_guide.md`'s
release strategy, `app.config.ts` already at `1.33.0`): EAS preview builds for both platforms
(required by task 16's new native module — this can't ship as an OTA update), physical-device
testing per the Pre-Release Checklist, then production builds once the Tech Lead signs off.

## Addendum — 3 further items (same release, all code-complete)

Filed after the 19-item batch closed, still v1.33.0 (no version bump — same full EAS build task
16 already required). Full write-up: `engineering/supabase.md`'s 2026-09-02 entry.

1. **"fetch-exchange-rates was never called" — investigated, turned out to be false.** Verified
   read-only against **prod** (service-role REST call using `.env.production`): `exchange_rates`
   has 450 rows / 18 `as_of` dates, newest `fetched_at` exactly at today's 05:30 UTC cron slot,
   every weekday since 2026-08-10 populated (weekend gaps are the ECB not publishing — expected).
   Verified **dev** the same way via `npx supabase db query --linked` (after `supabase link
   --project-ref aejywkbkcwyanhyzhrle`) — `cron.job` active, both vault secrets present,
   `cron.job_run_details` shows 5 consecutive `succeeded` runs. **Conclusion: the job runs
   correctly on both environments; no schedule change made.** A dashboard showing "never
   invoked" is most likely Edge Function log retention (free plan keeps ~1 day of logs) rather
   than an actual failure — worth remembering if this question comes up again rather than
   re-diagnosing from scratch. `npx supabase db query --linked "<sql>"` is now the known
   Docker-free way to inspect `cron.*`/`vault.*` on a linked project — add this to
   [[no-docker-on-machine]]'s toolkit.
   **Real bug found next door, fixed instead:** `getLatestExchangeRates()`
   (`packages/api/src/currencies.ts`) fetched the *entire* `exchange_rates` history table and
   deduped client-side — its own comment claimed it filtered server-side; it didn't. New RPC
   `get_latest_exchange_rates()` (migration `20260902100000`, `SECURITY INVOKER` — correct here
   since the table already grants open `SELECT` to `authenticated`, no RLS to bypass) does the
   `DISTINCT ON` in Postgres. Smoke-tested directly against prod post-deploy via the service-role
   REST API — one row per currency, as expected.

2. **Example trip enrichment + tutorial refresh.** `create-example-trip` (redeployed dev+prod,
   no schema change): added `description` to all demo expenses, a 4th expense
   (`related_type: 'accommodation'`) so the category donut shows four slices, `is_business: true`
   on the airport-transfer expense (without this the whole Business Summary header action stays
   hidden — `useHasBusinessExpenses` gate), and `booking_reference`/`external_url` on the public-
   transport seed row. **Deliberately did not seed** `expense_documents`/`transfer_documents` —
   Tech Lead decision: a metadata row with no uploaded Storage object renders a card whose
   signed-URL fetch 404s, and doing it properly costs Storage per signup. Tutorial: repurposed
   slide 3 ("Shared Calendar" → "Getting There" / transfer features, icon `calendar-outline` →
   `airplane-outline`), folded calendar content into slide 2, extended slide 4's copy for
   receipts/business expenses. Bumped `useTutorialSeen.ts`'s MMKV key `tutorial_seen_v3` → `v4`.
   Cannot verify demo-trip content live — creating a test account is a prohibited action
   regardless of context; needs the Tech Lead's own fresh signup on dev to eyeball.

3. **iOS force-update button fix.** Root cause confirmed directly in
   `node_modules/expo-in-app-updates/ios/ExpoInAppUpdatesModule.swift`: `startUpdate()` tries to
   `present()` `SKStoreProductViewController` on the same root VC `ForceUpdateGate`'s own RN
   `<Modal>` is already presented on — iOS silently refuses the second present, but the promise
   still resolves `true`, so the JS `catch` fallback to `Linking.openURL(STORE_URL)` is never
   reached. Fix: skip the native module on iOS entirely, call `Linking.openURL(STORE_URL)`
   directly (same path `openStoreReviewOrFallback()` already uses successfully there). Added an
   inline (not toast — this gate is its own native VC stack on iOS, a sibling `<ToastContainer/>`
   would render underneath and never be seen) failure message,
   `forceUpdate.openStoreFailed` i18n key. **Release-sequencing constraint, not a code detail:**
   `updateChecker.ts` blocks OTA delivery while this gate is showing, so **this fix must go out
   via `eas update` *before* v1.33.0 reaches the App Store** — otherwise every 1.32.x device that
   hits the old broken gate on the new release can never receive the fix over the air (they can
   still update manually from the App Store, just not automatically). Cannot verify the actual
   fix without a physical iPhone on a version below whatever ships — flagged for Tech Lead device
   testing, same as task 16 always was.

## Code-review fix pass — 10 findings, all fixed

`/code-review` ran against the full uncommitted diff (19-item batch + 3-item addendum) and
returned 10 findings (5 CONFIRMED, 5 PLAUSIBLE). I spot-verified every finding directly against
the code before writing the fix plan — all read exactly as reported. Full write-up:
`engineering/supabase.md`'s second 2026-09-02 entry (the one titled "code-review fixes, 2
migrations").

**2 migrations (both pushed dev then prod, verified via `db query --linked` on both):**
1. `delete_own_account()` could fail account deletion — its `transfer_documents`
   conflict-avoidance step only pre-empted the `(flight_id, user_id)` unique constraint, never
   the `(public_transport_id, user_id)` one added a migration later. Fixed by checking both
   parent-id branches. New migration `20260902110000`.
2. `transfer_public_transport` was missing `REPLICA IDENTITY FULL` (every sibling transfer table
   has it) — hard DELETE realtime events could silently miss the `trip_id` filter for other trip
   members. New migration `20260902110001`.

**8 app-layer fixes (no migration):**
3. `ExpenseCategoryChart.tsx` had no `colorful`-theme color branch (`isDark ? 'dark' : 'light'`
   silently gave colorful theme light-mode hues) — re-validated the existing light hex values
   against the colorful surface (`#FEE0AD`) via the `dataviz` skill's validator (they pass, same
   WARN-tier as light mode, same mitigation via direct labels), added as `colorful` key, replaced
   the boolean with a direct `CATEGORY_COLORS[category][theme]` lookup.
4. `updateExpenseWithSplits()` sent `p_is_business: input.is_business ?? false` instead of
   `?? null` — broke the NULL-means-keep-existing sentinel convention used one line above for
   `related_type`. Not reachable via the shipped UI today, fixed anyway (API contract
   correctness).
5. Quick-action "Adding to: {trip}" banner stuck true forever after first use —
   `cameFromQuickAction` was a lazy-only `useState` with no setter. Made it real state, reset at
   the FAB's `onPress`.
6. `useAppIconQuickAction`'s `QuickActions.initial` cold-start handler read the trips cache
   synchronously in the same effect as `addListener` — could race auth/cache hydration and
   silently drop the exact tap that launched the app. Split into its own effect gated on the
   reactive `trips` value, re-firing (ref-guarded to once) until it's loaded.
7. `SettlementsModal`'s exchange-rate disclosure/attribution only rendered inside the
   collapsed-by-default "Bank Balance Reality" section, while the always-visible balance card and
   settlements list both already show converted amounts. Hoisted the disclosure to render once,
   unconditionally, right after the balance card.
8. `documentStorage.ts` centralized Storage calls but not path *construction* — extracted
   `buildExpenseDocumentPath`/`buildTransferTicketPath` helpers, updated all three call sites
   (byte-identical output — confirmed safe against RLS, which only inspects path segments `[1]`
   tripId and `[4]` userId, never the shared `transfer` segment). Also added the missing
   `ttlSeconds` param to `getTransferDocumentUrl` to match its sibling.
9. `PublicTransportTicketsSection.tsx` was a near-total copy of `FlightTicketsSection.tsx`;
   `useTransferDocuments.ts` duplicated the same hook triad twice. Extracted a shared
   `TicketsSection.tsx` (presentational, hooks stay entity-specific and get passed in as mutation
   results) + collapsed the hook file to 3 generic factories used by both entity types' unchanged
   exported hook names — zero call-site changes elsewhere in the app.
10. `EditExpenseSheet.tsx`'s cover-split fallback chain
    (`coverActualPayer ?? currentUserId ?? expense.paid_by`) could regress to the original bug
    (`expense.paid_by` is the covered person, not the payer) in a narrow compound edge case.
    Added an intermediate fallback to any member other than `coveredFor` before ever reaching
    `expense.paid_by`.

`npm run typecheck` exits 0; `npm test` passes 282 tests, no regressions. Not independently
verifiable from this environment: the colorful-theme chart (needs a running themed session), the
quick-action cold-start race (native timing, needs a physical device), and the cover-split edge
case (needs a reproducible stale-refetch race) — flagged for the Tech Lead's own testing pass
alongside the batch's other device-only items (task 16, iOS force-update, Balances four-theme
pass).

## Post-manual-testing fixes — 2nd round (6 items, code-complete, not committed)

The 19-item batch + addendum + code-review pass were committed as `c2a7891` ("feat: v1.33.0 —
expense docs, business expenses, transfer overhaul, quick actions"). Manual device testing then
surfaced 6 more. Plan: `C:\Users\Gary\.claude\plans\lively-noodling-iverson.md`. All typecheck
+ `npm test` (282) green. Migration `20260902120000` + Edge Function `render-business-expense-pdf`
**deployed to dev AND prod** 2026-09-02 (Tech Lead confirmed near release / full rollout) —
see `engineering/supabase.md`. First dev push failed (`get_my_active_grants` OUT-column change
needs an explicit `DROP FUNCTION` — rolled back clean, added the DROP, re-pushed). Ledger +
object-fingerprint parity dev==prod confirmed. `database.types.ts` regenerated.

1. **Business Summary now downloads `.md` AND PDF** on every platform. New Edge Function
   `render-business-expense-pdf` (`pdf-lib` via esm.sh, `verify_jwt` + `auth.getUser`, returns
   `{ pdfBase64 }`) — client sends the same rows it renders into Markdown.
   `deliverBase64File()` added to `share.ts`. Web: two downloads. Native: PDF share sheet then
   MD share sheet. Degrades to MD-only (`toast.businessSummaryMdOnly`) if the function fails.
2. **"Cover" split method removed from Create + Edit expense.** It was never a *category* — the
   category enum is `accommodation|activity|transport|shopping|manual`; "cover" is an
   `EXPENSE_SPLIT_METHOD` value. Enum/schema/RPC keep accepting `'cover'` (existing rows, offline
   replay). Both sheets render the picker from `SELECTABLE_SPLIT_METHODS` (filters out `'cover'`).
   `EditExpenseSheet` opening a legacy cover expense **converts it on save** to an even split
   with the real payer (`splits[0].user_id`) restored, shown via a non-silent
   `edit.coverConverted` warning line. The per-split `covered_by` "Cover"/"Uncover" buttons in
   `ExpenseSplitBreakdown` are a *different* feature — untouched ("cover expenses of specific
   members" stays).
3. **Scrollable + auto-scrolling segment bars.** Root cause: `TransferSegmentedControl` was a
   plain `<View flex-row>`, never a ScrollView — `c2a7891`'s 5th segment ("Public Transport" /
   DE "Öffentliche Verkehrsmittel") overflowed with no scroll. New shared
   `apps/mobile/src/components/SegmentedControl.tsx` (horizontal ScrollView, `flexGrow:0`,
   `onLayout` x-capture + `scrollTo` on `activeKey` change — mirrors the outer trip tab bar in
   `app/trip/[id]/index.tsx`). Adopted by `TransferSegmentedControl`, `PreworkSegmentedControl`,
   `stuff.tsx`, `shopping.tsx` (all keep their public props). Outer trip tab bar left as-is.
4. **Quick-action icon → cash glyph.** iOS: `icon: 'symbol:dollarsign.circle.fill'` (SF Symbol,
   no asset). Android: `icon: 'ic_shortcut_expense'` + new local config plugin
   `apps/mobile/plugins/withQuickActionIcon.js` (`withDangerousMod`, writes one monochrome
   banknote `<vector>` to `res/drawable/`) — `expo-quick-actions@6` has no prop for a shortcut
   drawable. `'add'` never resolved on Android → OS-default "robot" icon. Native-only, Tech Lead
   device-tests.
5. **Ticket-row "open document" tap target enlarged.** `TicketsSection.tsx` (shared by
   Flight/PublicTransport): the whole name+icon region is now one 44px `Pressable` that opens
   the doc (was a bare 16px icon with `hitSlop={8}` jammed next to "Replace"); Replace + trash
   get `px-sm py-sm` + pressed feedback. Same treatment applied to `ExpenseDocumentsSection`.
6. **Travel-doc access timer starts on first view, per member, 7-day outer deadline.** Migration
   `20260902120000_document_access_first_view_timer.sql`: `document_access_grants` +
   `activated_at`, `grant_deadline`; `expires_at` NULL until first reveal. New
   `get_member_document_access_list` (metadata only, no decrypt/audit, safe to poll) +
   `reveal_member_documents` (decrypts one member, starts that grant's clock on first call,
   one audit row). `get_accessible_member_documents` dropped. `get_my_active_grants` +
   `create_document_access_request` guard updated for un-activated-within-deadline grants.
   `MemberDocumentsSheet` reworked into a member list + per-member "View" and **fully translated**
   (`memberDocs.*` EN+DE — was the only un-translated component in the feature).
   `ActiveGrantsBanner` shows "Not opened yet · auto-expires …". `database.types.ts` hand-edited
   to match pending `gen types --linked`.

**`/code-review` on the above — 5 findings, all fixed:**
1. `MemberDocumentsSheet` used `safeFromNow()` (a *past*-only clock-skew clamp) on the future
   `expires_at`/`grant_deadline` → every status line rendered "a few seconds ago". Switched to
   plain `dayjs(x).fromNow()` (what `ActiveGrantsBanner` already does).
2. `handleBusinessSummary` native path: PDF generated + MD share sheet dismissed → no toast, MD
   silently not delivered via the `shareText` fallback. Reworked: PDF first, then MD sheet,
   success toast fires once the PDF (primary file) is delivered regardless of the MD sheet.
3. `SegmentedControl` auto-scroll only ran on `activeKey` *change* — a deep-linked non-default
   segment (e.g. Transfer→PublicTransport, the 5th pill) stayed off-screen on mount. Now also
   scrolls from each pill's `onLayout` when its key is active.
4. PDF row-shaping in `expenses.tsx` duplicated `formatBusinessExpenseSummary`'s internal
   date/currency/payer/total formatting. Extracted `buildBusinessExpenseReport(input)` in
   `packages/utils/settlementText.ts` — single source of truth, feeds both the `.md` renderer
   and the PDF payload.
5. Web fired two back-to-back anchor downloads (Chrome "download multiple files" gate risk).
   Now PDF first, 400ms gap, then MD.

## Device-testing round 2 — 3 more bugs, all fixed (OTA-eligible, no migration/edge change)

1. **`shareFile()` was a silent no-op on device** — `share.ts` guarded on
   `requireOptionalNativeModule('ExpoSharing').isAvailableAsync`, but expo-sharing SDK 55's
   native module doesn't define `isAvailableAsync` at all (only the `.web` shim does), so the
   guard was always `undefined` → returned `'dismissed'` without ever presenting a sheet. This
   broke **every** `shareFile` caller on native (business summary, trip export, `downloadRemoteFile`).
   Fixed: `import * as Sharing from 'expo-sharing'` and call the package's own
   `Sharing.isAvailableAsync()` (has the correct `return true` native fallback), like
   `TripHighlightSheet` already did.
2. **Business Summary on native** now shares **just the PDF** (one reliable sheet). Two
   sequential `Sharing.shareAsync` calls don't work — iOS refuses to present sheet #2 while #1
   is dismissing. The PDF is the complete report (table, total, clickable receipt links), so
   dropping the separate `.md` sheet on native is acceptable; web still downloads both.
3. **Expense doc upload failed with `InvalidKey` on non-ASCII filenames** (`Buchungsbestätigung.png`).
   `buildExpenseDocumentPath` embedded the raw filename in the Storage key; Supabase rejects
   non-ASCII keys. Added `toStorageSafeName()` in `documentStorage.ts` (NFKD + strip combining
   marks + ASCII-only collapse); the `file_name` DB column still keeps the original for display.
   Transfer tickets were unaffected (fixed `.../ticket` path, no filename).
4. **Transfer ticket Replace/Delete buttons missing on Android** — the v1.33.0 tap-target change
   put a function `style` prop on the flex-row `Pressable`s, which doesn't lay out reliably on
   Android (the [[pressable-flex-android]] footgun). Rewrote `TicketsSection.tsx` +
   `ExpenseDocumentsSection.tsx` rows as `TouchableOpacity` + `activeOpacity` + static styles.

## v1.33.1 — quick-action follow-ups (code-complete, not committed)

Two defects filed after v1.33.0 device testing. Plan:
`C:\Users\Gary\.claude\plans\sprightly-frolicking-glade.md`. `npm run typecheck` 0, `npm test`
green (121 utils / 5 api / 161 mobile). See `engineering/supabase.md` 2026-09-03 entry.

1. **Android shortcut still showed the OS robot glyph, not the cash icon.** The v1.33.0 2nd-round
   fix (`withQuickActionIcon.js` shipping a `<vector>` to `res/drawable/`) didn't hold on device.
   `expo-quick-actions` resolves the icon at runtime via
   `res.getIdentifier("ic_shortcut_expense", …)` with the name passed from JS. Two contributing
   causes: **(a) R8 resource shrinking** (`enableShrinkResourcesInReleaseBuilds: true`) — its
   default "safe" mode only protects names that appear as compiled string constants, not a JS-only
   name, so the drawable is stripped in release → `getIdentifier` returns 0 → robot (same reason
   `expo-dev-launcher`/`expo-dev-menu` ship their own `res/raw/keep.xml`); **(b) cross-process
   VectorDrawable inflation** in the launcher process, a known robot-fallback trigger. Fix in
   `withQuickActionIcon.js` covers both: ship a **raster PNG** at
   `res/drawable-xxxhdpi/ic_shortcut_expense.png` (source
   `apps/mobile/assets/images/ic_shortcut_expense.png`, 192px), write `res/raw/keep.xml` (in the
   `main` source set) with `tools:keep="@drawable/ic_shortcut_expense"`, delete any stale vector,
   and throw if the source asset isn't committed. Cheap post-hoc check: `unzip -l` the last
   v1.33.0 APK to see whether the drawable was actually stripped.
   **General lesson → [[android-runtime-resource-shrinking]].**
2. **Quick action never targeted an upcoming trip.** `resolveActiveTrip()` gained a middle tier —
   next planned trip (soonest future `start_date`) — between "date covers today" and the
   most-recently-created fallback, and now also excludes `status === 'completed'` (not just
   `archived`), matching `getEffectiveStatus`. Tests: 6 → 11 cases.

## Key decisions to not re-litigate

- Document buckets: **private**, any trip member can view, only uploader-or-organizer can
  upload/replace/delete.
- Cover→multi split: mutate in place, no history/versioning mechanism.
- Chip→dropdown scope: category pickers + expense "paid by" + packing-list category. Split-method
  and member multi-select stay as chips.
- v1.33.0 ships as a **full EAS build** (task 16 forces it), so native deps added mid-batch
  (`expo-document-picker`, `react-native-svg`) aren't a release-strategy problem.
- Every Supabase migration this batch: pushed to dev then prod immediately, ledger-parity checked
  via `npx supabase migration list` (no Docker on this machine — see [[no-docker-on-machine]]),
  typed via `npx supabase gen types typescript --linked`.
