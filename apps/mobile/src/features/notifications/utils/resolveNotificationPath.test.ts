import { describe, it, expect } from 'vitest';
import { resolveNotificationPath } from './resolveNotificationPath';
import type { Notification } from '@vacationist/types';

type Input = Pick<Notification, 'type' | 'trip_id' | 'related_type'> & { related_id?: string | null };

const TRIP = 'trip-abc';
const RECEIPT = 'receipt-uuid-123';

function n(type: Notification['type'], related_type: string | null = null, related_id?: string | null): Input {
  return { type, trip_id: TRIP, related_type, related_id };
}

describe('resolveNotificationPath', () => {
  it('returns null when trip_id is empty string', () => {
    expect(resolveNotificationPath({ type: 'new_activity', trip_id: '', related_type: null })).toBeNull();
  });

  it('routes new_activity to Activities tab', () => {
    expect(resolveNotificationPath(n('new_activity'))).toBe(`/trip/${TRIP}?tab=Activities`);
  });

  it('routes schedule_change to Activities tab', () => {
    expect(resolveNotificationPath(n('schedule_change'))).toBe(`/trip/${TRIP}?tab=Activities`);
  });

  it('routes vote_finalized with accommodation related_type to Base tab', () => {
    expect(resolveNotificationPath(n('vote_finalized', 'accommodation'))).toBe(`/trip/${TRIP}?tab=Base`);
  });

  it('routes vote_finalized with activity related_type to Activities tab', () => {
    expect(resolveNotificationPath(n('vote_finalized', 'activity'))).toBe(`/trip/${TRIP}?tab=Activities`);
  });

  it('routes vote_finalized with null related_type to Activities tab', () => {
    expect(resolveNotificationPath(n('vote_finalized', null))).toBe(`/trip/${TRIP}?tab=Activities`);
  });

  it('routes vote_update with accommodation related_type to Base tab', () => {
    expect(resolveNotificationPath(n('vote_update', 'accommodation'))).toBe(`/trip/${TRIP}?tab=Base`);
  });

  it('routes vote_update with non-accommodation related_type to Activities tab', () => {
    expect(resolveNotificationPath(n('vote_update', 'activity'))).toBe(`/trip/${TRIP}?tab=Activities`);
  });

  it('routes expense_change to Expenses tab', () => {
    expect(resolveNotificationPath(n('expense_change'))).toBe(`/trip/${TRIP}?tab=Expenses`);
  });

  it('routes new_member to Settings tab', () => {
    expect(resolveNotificationPath(n('new_member'))).toBe(`/trip/${TRIP}?tab=Settings`);
  });

  it('routes reminder to trip root (no tab)', () => {
    expect(resolveNotificationPath(n('reminder'))).toBe(`/trip/${TRIP}`);
  });

  it('routes document_access_request to profile tab (no trip_id in path)', () => {
    expect(resolveNotificationPath(n('document_access_request'))).toBe('/(tabs)/profile');
  });

  it('routes vote_finalized to trip root when no related_type matches accommodation', () => {
    expect(resolveNotificationPath(n('vote_finalized', 'flight'))).toBe(`/trip/${TRIP}?tab=Activities`);
  });

  describe('expense_settlement', () => {
    it('routes to settlement-receipt screen when related_id is present', () => {
      expect(resolveNotificationPath(n('expense_settlement', null, RECEIPT))).toBe(
        `/trip/${TRIP}/settlement-receipt?receiptId=${RECEIPT}`,
      );
    });

    it('falls back to Expenses tab when related_id is null', () => {
      expect(resolveNotificationPath(n('expense_settlement', null, null))).toBe(
        `/trip/${TRIP}?tab=Expenses`,
      );
    });

    it('falls back to Expenses tab when related_id is undefined', () => {
      expect(resolveNotificationPath(n('expense_settlement'))).toBe(
        `/trip/${TRIP}?tab=Expenses`,
      );
    });

    it('returns null when trip_id is empty', () => {
      expect(resolveNotificationPath({ type: 'expense_settlement', trip_id: '', related_type: null, related_id: RECEIPT })).toBeNull();
    });
  });
});
