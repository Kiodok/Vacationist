import * as Sentry from '@sentry/react-native';

export function initSentry() {
  Sentry.init({
    dsn: 'https://4361026941fc6ad001982cd4eb4f9894@o4511437954285568.ingest.de.sentry.io/4511437956972624',

    // Do NOT send default PII (IP, cookies, user context) — set user
    // explicitly via Sentry.setUser({ id }) after sign-in instead.
    sendDefaultPii: false,

    // Structured logs via Sentry.logger.*
    enableLogs: true,

    // Session Replay — record full sessions at 10% rate, 100% on errors.
    // maskAllText + maskAllImages prevent sensitive screen content (travel
    // documents, financial data) from appearing in replays.
    replaysSessionSampleRate: __DEV__ ? 0 : 0.1,
    replaysOnErrorSampleRate: 1,

    integrations: [
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
      }),
      Sentry.feedbackIntegration(),
    ],

    // Only active in preview/production EAS builds — skipped in local dev
    enabled: !__DEV__,
    debug: false,
  });
}
