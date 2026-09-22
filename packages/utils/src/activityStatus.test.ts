import { describe, it, expect } from 'vitest';
import { dayjs } from './dayjs';
import { isActivityAutoCompleted, isActivityOngoing, isActivityHappeningNow } from './activityStatus';

// `dayjs('…')` without a zone is device-local, so building "now" the same way keeps these
// assertions independent of the machine's timezone — which is exactly the property under test:
// the digits typed by the organizer are compared with the device's wall clock, nothing else.
const now = (s: string) => dayjs(s);
const act = (date: string | null, start: string | null, end: string | null) => ({ activity_date: date, start_time: start, end_time: end });

describe('isActivityOngoing (floating wall-clock)', () => {
  // The scenario from the 21.09 test session: planned in Germany for 14:00–16:00, flown to Porto.
  // On a phone in Porto at 14:30 local the activity is on, regardless of what Germany's clock says.
  it('is on at 14:30 device-local for a 14:00–16:00 activity', () => {
    expect(isActivityOngoing(act('2026-09-21', '14:00:00', '16:00:00'), now('2026-09-21T14:30:00'))).toBe(true);
  });
  it('is not on before the start or after the end', () => {
    expect(isActivityOngoing(act('2026-09-21', '14:00:00', '16:00:00'), now('2026-09-21T13:59:00'))).toBe(false);
    expect(isActivityOngoing(act('2026-09-21', '14:00:00', '16:00:00'), now('2026-09-21T16:01:00'))).toBe(false);
  });
  it('handles an activity that crosses midnight', () => {
    const a = act('2026-09-21', '22:00:00', '01:00:00');
    expect(isActivityOngoing(a, now('2026-09-22T00:30:00'))).toBe(true);
    expect(isActivityOngoing(a, now('2026-09-22T01:30:00'))).toBe(false);
  });
  it('a start-only activity lasts two hours; an all-day one lasts its day', () => {
    expect(isActivityOngoing(act('2026-09-21', '10:00:00', null), now('2026-09-21T11:59:00'))).toBe(true);
    expect(isActivityOngoing(act('2026-09-21', '10:00:00', null), now('2026-09-21T12:01:00'))).toBe(false);
    expect(isActivityOngoing(act('2026-09-21', null, null), now('2026-09-21T23:00:00'))).toBe(true);
    expect(isActivityOngoing(act('2026-09-21', null, null), now('2026-09-22T00:01:00'))).toBe(false);
  });
  it('a dateless activity is never ongoing', () => {
    expect(isActivityOngoing(act(null, '10:00:00', null), now('2026-09-21T10:30:00'))).toBe(false);
  });
});

describe('isActivityAutoCompleted', () => {
  it('completes once the end has passed', () => {
    expect(isActivityAutoCompleted(act('2026-09-21', '14:00:00', '16:00:00'), now('2026-09-21T16:01:00'))).toBe(true);
    expect(isActivityAutoCompleted(act('2026-09-21', '14:00:00', '16:00:00'), now('2026-09-21T15:59:00'))).toBe(false);
  });
  it('a midnight-crossing activity ends the next day', () => {
    const a = act('2026-09-21', '22:00:00', '01:00:00');
    expect(isActivityAutoCompleted(a, now('2026-09-21T23:30:00'))).toBe(false);
    expect(isActivityAutoCompleted(a, now('2026-09-22T01:30:00'))).toBe(true);
  });
  it('start-only completes 2 h later, all-day when its day is over', () => {
    expect(isActivityAutoCompleted(act('2026-09-21', '10:00:00', null), now('2026-09-21T12:01:00'))).toBe(true);
    expect(isActivityAutoCompleted(act('2026-09-21', null, null), now('2026-09-21T23:59:00'))).toBe(false);
    expect(isActivityAutoCompleted(act('2026-09-21', null, null), now('2026-09-22T00:01:00'))).toBe(true);
  });
});

describe('isActivityHappeningNow', () => {
  it('only lights up on the day itself, from its start', () => {
    const a = act('2026-09-21', '14:00:00', '16:00:00');
    expect(isActivityHappeningNow(a, now('2026-09-21T15:00:00'))).toBe(true);
    expect(isActivityHappeningNow(a, now('2026-09-22T15:00:00'))).toBe(false);
    expect(isActivityHappeningNow(a, now('2026-09-21T13:00:00'))).toBe(false);
  });
  it('without an end it stays lit for the rest of the day', () => {
    expect(isActivityHappeningNow(act('2026-09-21', '14:00:00', null), now('2026-09-21T23:00:00'))).toBe(true);
  });
});
