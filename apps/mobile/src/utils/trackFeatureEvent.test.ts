import { describe, it, expect, vi, beforeEach } from 'vitest';

// trackFeatureEvent pulls in react-native, the Supabase-backed API package and two
// MMKV-backed stores, none of which load in the node test env — mock the boundaries and
// assert on what would have been sent to the track-event Edge Function.
const mocks = vi.hoisted(() => ({
  platform: { OS: 'web' as string },
  logAnalyticsEvent: vi.fn(),
  consentDecision: 'granted' as 'granted' | 'denied' | null,
  attribution: null as Record<string, string> | null,
}));

vi.mock('react-native', () => ({ Platform: mocks.platform }));
vi.mock('@vacationist/api', () => ({ logAnalyticsEvent: mocks.logAnalyticsEvent }));
vi.mock('../stores/consentStore', () => ({
  useConsentStore: { getState: () => ({ decision: mocks.consentDecision }) },
}));
vi.mock('../features/consent/utils/webAttribution', () => ({
  getWebAttribution: () => mocks.attribution,
}));

import { trackFeatureEvent } from './trackFeatureEvent';

beforeEach(() => {
  mocks.platform.OS = 'web';
  mocks.consentDecision = 'granted';
  mocks.attribution = null;
  mocks.logAnalyticsEvent.mockReset();
  mocks.logAnalyticsEvent.mockResolvedValue(undefined);
});

describe('trackFeatureEvent', () => {
  it('forwards stored first-touch attribution so an activation event is credited to its campaign', () => {
    mocks.attribution = {
      utm_source: 'producthunt',
      utm_medium: 'launch',
      utm_campaign: 'ph-launch-2026',
    };

    trackFeatureEvent('trip_created');

    expect(mocks.logAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(mocks.logAnalyticsEvent).toHaveBeenCalledWith({
      event_name: 'trip_created',
      surface: 'web_app',
      path: undefined, // no `window` in the node env
      utm_source: 'producthunt',
      utm_medium: 'launch',
      utm_campaign: 'ph-launch-2026',
    });
  });

  it('forwards a Reddit click id alongside utm params', () => {
    mocks.attribution = { rdt_cid: 'abc123', utm_source: 'reddit' };

    trackFeatureEvent('invite_accepted');

    expect(mocks.logAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: 'invite_accepted', rdt_cid: 'abc123', utm_source: 'reddit' }),
    );
  });

  it('sends no attribution keys at all when the visitor has none (organic)', () => {
    mocks.attribution = null;

    trackFeatureEvent('expense_added');

    const payload = mocks.logAnalyticsEvent.mock.calls[0][0];
    expect(payload.event_name).toBe('expense_added');
    expect(payload).not.toHaveProperty('utm_source');
    expect(payload).not.toHaveProperty('utm_campaign');
    expect(payload).not.toHaveProperty('rdt_cid');
  });

  it('sends nothing until consent is granted', () => {
    mocks.attribution = { utm_source: 'producthunt' };
    mocks.consentDecision = null;
    trackFeatureEvent('trip_created');

    mocks.consentDecision = 'denied';
    trackFeatureEvent('trip_created');

    expect(mocks.logAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('sends nothing on native (the native app has no consent mechanism and no analytics)', () => {
    mocks.attribution = { utm_source: 'producthunt' };
    mocks.platform.OS = 'ios';
    trackFeatureEvent('trip_created');

    mocks.platform.OS = 'android';
    trackFeatureEvent('trip_created');

    expect(mocks.logAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('skips events tied to the auto-seeded example trip', () => {
    mocks.attribution = { utm_source: 'producthunt' };

    trackFeatureEvent('expense_added', { isExampleTrip: true });

    expect(mocks.logAnalyticsEvent).not.toHaveBeenCalled();
  });

  it('never lets an analytics failure escape (it must not block or fail a mutation)', async () => {
    mocks.logAnalyticsEvent.mockRejectedValue(new Error('network down'));

    expect(() => trackFeatureEvent('trip_created')).not.toThrow();
    await Promise.resolve(); // let the swallowed rejection settle; an unhandled one would fail the run
  });
});
