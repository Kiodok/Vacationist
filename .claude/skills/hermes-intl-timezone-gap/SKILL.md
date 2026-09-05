---
name: hermes-intl-timezone-gap
description: React Native's Hermes JS engine can resolve a named IANA timezone (via dayjs.tz(dateString, 'Region/City') / Intl.DateTimeFormat) differently than V8 (Node, browsers, Web). A bug report shaped like "identical code, wrong only on Android/iOS, correct on Web, never reproduces in the (Node-run) test suite" is the signature of this — suspect the engine before re-auditing the algorithm. The most robust fix is usually removing the named-timezone dependency entirely when the value is really a plain DATE (no time-of-day, no real instant) rather than trying to work around the engine gap.
---

# Hermes can resolve a named timezone differently than V8 — suspect the engine, not the algorithm

Found 2026-09-05 while chasing what looked like a persistent calendar bug in v1.34.0 (see
[[v1-34-0-batch]] item 10 for the full concrete instance). Worth its own skill because the
diagnostic pattern — not just this one bug — is likely to recur anywhere else in this app that
calls `dayjs.tz(dateString, someNamedZone)` on a value that's actually just a plain calendar date.

## The pattern to recognize

A bug report where the exact same source code is reported correct on Web but wrong on Android/iOS,
AND the existing test suite (which only ever runs under Node, i.e. V8) never catches it. That
combination — not "sometimes wrong," not "wrong on one specific device," but "wrong on every
native device, right everywhere else, right in every local test" — is the signature of a
JS-engine discrepancy, not a logic bug. Verify this by extracting the suspect function's exact
logic into a standalone Node script and running it against the actual reported repro values — if
it comes back correct, the algorithm is exonerated and the engine becomes the prime suspect.

## Why it happens

`dayjs`'s timezone plugin (`dayjs.tz(input, zoneName)`) resolves a named IANA zone
(`'Europe/Berlin'`, etc.) via the JS engine's own `Intl.DateTimeFormat` / bundled ICU timezone
database. Hermes (React Native's engine) has historically had a different, sometimes incomplete,
ICU/timezone dataset compared to a full V8 runtime (Node, Chrome, and — critically for this app —
the Web build, which also runs on real V8 via the browser). A named-zone lookup that resolves
correctly in Node or a browser is not guaranteed to resolve identically on Hermes.

## The fix that actually holds, vs. the one that doesn't

The tempting fix is a deeper timezone conversion — that's exactly what caused this class of bug
in the first place: v1.34.0 item 10 was "fixed" once already by routing through
`dayjs.tz(dateString, trip.timezone)`, which reintroduced the exact same symptom on native.

The fix that actually holds is asking whether the value genuinely needed a named timezone at all.
A `DATE`-only column (no time-of-day, no real association with an instant — this app's
`trips.start_date`/`end_date`, `activities.activity_date`, etc.) does NOT need timezone resolution
to do calendar-date arithmetic on it: "how many days between two dates" or "is this the same day"
has no genuine dependency on DST or UTC offset, because those only affect wall-clock *time*, never
how calendar dates are counted. Parsing with `dayjs.utc(dateString)` instead — fixed,
engine-independent UTC math, no IANA database lookup at all — gives the identical correct result
without ever touching the Hermes-dependent code path.

## When a real timezone dependency IS unavoidable

A genuinely different question — "what is today's date, from a specific place's point of view
right now" (`formatCalendarDayHeader`'s `isToday` field, `packages/utils/src/calendar.ts`, is the
concrete example) — really does need to resolve the current instant against a named zone; there's
no timezone-free way to ask that. That kind of call keeps a real `dayjs().tz(zone)` dependency and
could still be a residual, narrower instance of this same Hermes gap — worth an explicit on-device
test whenever a "compare against right now, in a specific zone" calculation is added or touched,
since it can't be designed away the way pure date-range math can.

## How to apply

- Before adding or keeping a `dayjs.tz(x, namedZone)` call, ask: does `x` represent a real instant
  (has a genuine time-of-day, actually happened/will happen at a specific moment), or is it a bare
  calendar date with no time component? If the latter, use `dayjs.utc(x)` instead — it needs no
  timezone database and is immune to this whole bug class.
- If a bug report says "identical code, wrong only on native (Android/iOS), fine on Web, and the
  test suite doesn't catch it," check for a `dayjs.tz()` (or raw `Intl.DateTimeFormat` with a
  named zone) call in the suspect path before spending time re-auditing the surrounding logic.
- The local test suite (Vitest, runs under Node/V8) cannot catch this bug class at all — it isn't
  a substitute for an on-device check whenever a fix touches timezone-resolution code specifically.

Related: [[v1-34-0-batch]] (the concrete instance), [[no-docker-on-machine]] (a different, but
similarly "can't be caught by the local toolchain" class of gap).
