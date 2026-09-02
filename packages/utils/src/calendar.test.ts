import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { generateDateRange, formatCalendarDayHeader } from './calendar';
import { initDayjs } from './dayjs';

beforeAll(() => initDayjs());

// Task 12/13 regression: a date-only 'YYYY-MM-DD' string parses as UTC midnight, and
// formatting it without .tz()/.utc() converts to the *device's* local timezone first — on any
// device behind UTC this rolls the displayed/enumerated date back a day. These tests force the
// process into a behind-UTC timezone to prove the fix holds regardless of the runner's TZ,
// exactly as the plan calls for ("run once under TZ=Pacific/Kiritimati or similar to confirm").
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
    expect(generateDateRange('2026-09-02', '2026-09-05', 'Europe/Berlin')).toEqual([
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ]);
  });

  it('is stable across timezones without an explicit timezone param (falls back to UTC)', () => {
    expect(generateDateRange('2026-09-02', '2026-09-03')).toEqual(['2026-09-02', '2026-09-03']);
  });

  it('handles a single-day trip', () => {
    expect(generateDateRange('2026-01-01', '2026-01-01', 'Pacific/Auckland')).toEqual(['2026-01-01']);
  });
});

describe('formatCalendarDayHeader (timezone independence)', () => {
  const ORIGINAL_TZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'America/Los_Angeles';
  });

  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it('renders the trip-timezone date, not the device-local rollback', () => {
    const result = formatCalendarDayHeader('2026-09-02', 'Europe/Berlin');
    expect(result.dayNumber).toBe('2');
    expect(result.monthShort).toBe('Sep');
  });
});
