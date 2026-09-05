import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { generateDateRange, formatCalendarDayHeader } from './calendar';
import { initDayjs } from './dayjs';

beforeAll(() => initDayjs());

// Task 12/13 regression: a date-only 'YYYY-MM-DD' string parses as UTC midnight, and
// formatting it without .tz()/.utc() converts to the *device's* local timezone first — on any
// device behind UTC this rolls the displayed/enumerated date back a day. These tests force the
// process into a behind-UTC timezone to prove the fix holds regardless of the runner's TZ,
// exactly as the plan calls for ("run once under TZ=Pacific/Kiritimati or similar to confirm").
//
// v1.34.0 follow-up: generateDateRange no longer accepts a timezone argument at all (see its doc
// comment in calendar.ts) — an earlier version took one and used dayjs.tz(dateString, timezone),
// which reintroduced this exact bug on-device (Hermes resolves named IANA zones differently than
// V8), invisible to this suite since it only ever runs under Node/V8. There is nothing left here
// for a timezone argument to affect — these tests document that a date-only range is pure
// calendar arithmetic, not a further regression guard against a parameter that no longer exists.
describe('generateDateRange (timezone independence)', () => {
  const ORIGINAL_TZ = process.env.TZ;

  beforeEach(() => {
    // America/Los_Angeles (UTC-7/-8) reproduced the original bug reliably: parsing
    // '2026-09-02' as UTC midnight and formatting in this local zone rolls it back to '09-01'.
    process.env.TZ = 'America/Los_Angeles';
  });

  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it('enumerates every day of the trip without dropping the last day or inserting a bogus first day', () => {
    expect(generateDateRange('2026-09-02', '2026-09-05')).toEqual([
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ]);
  });

  it('handles a single-day trip', () => {
    expect(generateDateRange('2026-01-01', '2026-01-01')).toEqual(['2026-01-01']);
  });

  // v1.34.0 item 10: the global calendar tab's month-grid coverage band used to build its own
  // date set with bare dayjs(trip.start_date)/dayjs(trip.end_date) instead of calling this
  // function, reintroducing the exact bug this describe block already guards against (a user
  // shifted a trip's year by +1 and the calendar band silently dropped the new end date). These
  // additional cases cover boundaries the original regression tests above didn't exercise.

  it('does not skip or double-count a day across a spring-forward DST transition (2026-03-29)', () => {
    // DST changes clock time, never how many calendar days lie between two dates — this range
    // must come out identical regardless of whether any real-world zone had a transition in it.
    expect(generateDateRange('2026-03-27', '2026-03-31')).toEqual([
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
    ]);
  });

  it('does not skip or double-count a day across a fall-back DST transition (2026-10-25)', () => {
    expect(generateDateRange('2026-10-23', '2026-10-27')).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ]);
  });

  it('includes both sides of a calendar-year boundary', () => {
    expect(generateDateRange('2026-12-30', '2027-01-03')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });
});

describe('formatCalendarDayHeader', () => {
  const ORIGINAL_TZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'America/Los_Angeles';
  });

  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it('renders the given date, not a device-local rollback, regardless of the timezone argument', () => {
    // dayName/dayNumber/monthShort no longer use the timezone argument at all (see calendar.ts's
    // doc comment) — passing two different named zones (SupportedTimezone only offers European
    // ones, but Berlin/Lisbon still differ by a real UTC offset) must produce identical labels.
    const berlin = formatCalendarDayHeader('2026-09-02', 'Europe/Berlin');
    expect(berlin.dayNumber).toBe('2');
    expect(berlin.monthShort).toBe('Sep');

    const lisbon = formatCalendarDayHeader('2026-09-02', 'Europe/Lisbon');
    expect(lisbon.dayNumber).toBe('2');
    expect(lisbon.monthShort).toBe('Sep');
    expect(lisbon.dayName).toBe(berlin.dayName);
  });
});
