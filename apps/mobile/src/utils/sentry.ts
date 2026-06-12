import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import * as Application from 'expo-application';
import type { MemberRole } from '@vacationist/types';

export function initSentry() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN
      || 'https://4361026941fc6ad001982cd4eb4f9894@o4511437954285568.ingest.de.sentry.io/4511437956972624',

    // Tag events by deployment channel so preview vs production are distinct.
    environment: __DEV__ ? 'development' : (Updates.channel ?? 'production'),
    // Native app version for the release; OTA update ID as dist for precise bundle correlation.
    release: Application.nativeApplicationVersion ?? undefined,
    dist: Updates.updateId ?? Application.nativeBuildVersion ?? undefined,

    // 20% performance tracing, 10% CPU profiling. Zero in local dev.
    tracesSampleRate: __DEV__ ? 0 : 0.2,
    profilesSampleRate: __DEV__ ? 0 : 0.1,

    // Do NOT send default PII (IP, cookies). User is set explicitly via setSentryUser().
    sendDefaultPii: false,

    enableLogs: true,
    attachScreenshot: Platform.OS !== 'web',
    maxBreadcrumbs: 50,

    replaysSessionSampleRate: __DEV__ ? 0 : 0.1,
    replaysOnErrorSampleRate: 1,

    integrations: Platform.OS !== 'web' ? [
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
      }),
      Sentry.feedbackIntegration(),
    ] : [],

    beforeSend(event) {
      // Strip invite tokens that could appear in fetch breadcrumb URLs.
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((bc) => {
          if (bc.category === 'fetch' && bc.data?.url) {
            bc.data.url = String(bc.data.url).replace(/token=[^&]+/g, 'token=REDACTED');
          }
          return bc;
        });
      }
      return event;
    },

    enabled: !__DEV__,
    debug: false,
  });
}

// ── User identity ─────────────────────────────────────────────────────────────

export function setSentryUser(userId: string, locale?: string | null) {
  Sentry.setUser({ id: userId });
  if (locale) Sentry.setTag('locale', locale);
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

// ── Trip context ──────────────────────────────────────────────────────────────

export function setSentryTripContext(tripId: string, role: MemberRole) {
  Sentry.setContext('trip', { tripId, role });
  Sentry.setTag('trip_id', tripId);
  Sentry.setTag('member_role', role);
}

export function clearSentryTripContext() {
  Sentry.setContext('trip', null);
  Sentry.setTag('trip_id', '');
  Sentry.setTag('member_role', '');
}

// ── Manual breadcrumbs ────────────────────────────────────────────────────────

export function addSentryBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
) {
  Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}
