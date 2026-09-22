---
name: floating-wall-clock-times
description: Use before touching anything timezone-related — trip/profile timezone fields, `dayjs.tz`, activity ongoing/completed/today logic, the activity-reminder cron, `users.timezone`/`trips.timezone`, or when someone asks to "add a timezone picker". Records the v1.39.0 decision that times FLOAT and there is no manual timezone selection.
---

# Floating wall-clock times (v1.39.0 — no manual timezone selection)

**Rule:** a time the user types is the literal digits, in no timezone. An activity planned in Germany for
14:00–16:00 is still 14:00–16:00 after the group flies to Porto. There is **no timezone picker anywhere** (trip
create/edit, profile) and no "trip timezone" display.

**Why:** the Tech Lead's test session asked for manual selection to be removed entirely ("this should happen in
the background so the user doesn't notice"). Every user-entered time was already stored as naive digits, so
display never needed a zone; the picker only fed (a) "is it ongoing?" comparisons and (b) reminder timing — and
made both wrong for anyone travelling. Also, `dayjs.tz` resolves named zones through platform ICU, which
differs on Hermes vs V8 (see [[hermes-intl-timezone-gap]]).

**How to apply:**
- Date-only values → `dayjs.utc(value)`; never `dayjs.tz(dateString, zone)`.
- "Now" comparisons → `packages/utils/src/activityStatus.ts` (`isActivityOngoing`, `isActivityAutoCompleted`,
  `isActivityHappeningNow`): device wall clock vs the typed digits. `dayjs('YYYY-MM-DDTHH:mm')` parses local — that
  is intentional.
- `trips.timezone` (filled from `getDeviceTimezone()` at creation) and `users.timezone` (kept = the phone's zone by
  `useDeviceTimezoneSync`) exist **only for the server**. Never show or let the user edit them.
- The one server consumer is `private.create_activity_reminders()`: per (activity, member),
  `COALESCE(users.timezone, trips.timezone, 'Europe/Berlin')` validated against `pg_timezone_names`, per-member
  2-hour dedup (migration `20260921110000`). It reads a bad zone name as "fall through", never as an error.
- Don't reintroduce `SUPPORTED_TIMEZONES`, `TimezoneField`, `timezones.ts`, or a `timezone` prop on calendar
  components.
- Marketing copy `feat.6.desc` in `docs/i18n/{en,de}.js` still says "displayed in the trip's timezone" — fix with
  `npm run build:site` when touching the site.
