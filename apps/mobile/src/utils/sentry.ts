import * as Sentry from '@sentry/react-native';

export function initSentry() {
  Sentry.init({
    dsn: 'https://4361026941fc6ad001982cd4eb4f9894@o4511437954285568.ingest.de.sentry.io/4511437956972624',

    // Include IP, cookies, user context in error reports
    sendDefaultPii: true,

    // Structured logs via Sentry.logger.*
    enableLogs: true,

    // Session Replay — record full sessions at 10% rate, 100% on errors
    replaysSessionSampleRate: __DEV__ ? 0 : 0.1,
    replaysOnErrorSampleRate: 1,

    integrations: [
      Sentry.mobileReplayIntegration(),
      Sentry.feedbackIntegration(),
    ],

    // Only active in preview/production EAS builds — skipped in local dev
    enabled: !__DEV__,
    debug: false,
  });
}
