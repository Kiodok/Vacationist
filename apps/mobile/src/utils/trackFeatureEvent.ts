import { Platform } from 'react-native';
import { logAnalyticsEvent } from '@vacationist/api';
import type { ProductFunnelEvent } from '@vacationist/types';
import { useConsentStore } from '../stores/consentStore';
import { getWebAttribution } from '../features/consent/utils/webAttribution';

/**
 * Records a web-app activation-funnel event (Growth Plan Q4 2026, Phase 0) — a trip
 * created, an invite link generated, an invite accepted, an expense added.
 *
 * Web-app surface ONLY. `track-event` rejects originless native requests (403), the
 * native app has no consent mechanism, and docs/privacy-policy.html + the marketing
 * site commit to no analytics inside the native app. The `Platform.OS` guard lives
 * here so shared call sites (e.g. mutationDefaults.ts, which also runs on native)
 * don't each need it.
 *
 * Consent-gated exactly like StoreBadges (imperative read of the web consent store).
 * Best-effort: packages/api's logAnalyticsEvent throws by contract, so the error is
 * swallowed here — analytics must never block or fail a mutation.
 *
 * Carries the visitor's first-touch attribution (utm_* / rdt_cid) so an activation event can
 * be credited to the campaign that brought the user in — without it, a campaign is only
 * measurable up to `sign_up`. The stored value only exists once consent was granted
 * (webAttribution.commitPendingWebAttribution), which the gate above already requires.
 *
 * @param opts.isExampleTrip pass the result of isCachedExampleTrip(tripId) for
 *   events tied to a trip; the auto-seeded demo trip is excluded from the funnel.
 */
export function trackFeatureEvent(
  eventName: ProductFunnelEvent,
  opts?: { isExampleTrip?: boolean },
): void {
  if (Platform.OS !== 'web') return;
  if (opts?.isExampleTrip) return;
  if (useConsentStore.getState().decision !== 'granted') return;

  logAnalyticsEvent({
    event_name: eventName,
    surface: 'web_app',
    path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    ...(getWebAttribution() ?? {}),
  }).catch(() => {});
}
