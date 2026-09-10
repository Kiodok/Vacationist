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

    // Drop errors injected by in-app browsers (Instagram, Facebook, etc.) that try
    // to call window.webkit.messageHandlers when the native bridge is unavailable.
    ignoreErrors: [
      /window\.webkit\.messageHandlers/,
      /evaluating 'window\.webkit/,
      'sendDataToNative',
      // Benign web-only unmount race in a third-party measurement path
      // (react-native-safe-area-context / react-remove-scroll call
      // getComputedStyle on a node that detached before a late transitionend).
      /getComputedStyle' must be an instance of Element/,
      /Argument 1 \('element'\) to Window\.getComputedStyle/,
    ],
    // app:/// is the synthetic URL scheme used by IAB-injected scripts — never our code.
    denyUrls: [
      /^app:\/\/\//,
    ],

    // Performance tracing + CPU profiling off (v1.37.3). They add sampled
    // profilers and per-transaction span/stall/frame tracking — main-thread work
    // and memory for near-zero product value on an app this size. This also
    // turns off stall/slow-frame tracking; accepted trade-off.
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    enableAutoPerformanceTracing: false,

    // Watchdog-termination ("Out of Memory") tracking off (v1.37.3). It's a
    // stackless diagnosis-by-elimination heuristic that misfires on
    // force-quit-from-switcher and first-launch-after-install — high noise, not
    // actionable. A real OOM would surface first as a JS render/allocation crash.
    enableWatchdogTerminationTracking: false,

    // Do NOT send default PII (IP, cookies). User is set explicitly via setSentryUser().
    sendDefaultPii: false,

    enableLogs: true,
    attachScreenshot: Platform.OS !== 'web',
    maxBreadcrumbs: 50,

    replaysSessionSampleRate: __DEV__ ? 0 : 0.1,
    // < 1 so the SDK dice-rolls replay eligibility at session start — ~80% of
    // sessions then carry no rolling in-memory frame buffer at all (v1.37.3).
    replaysOnErrorSampleRate: __DEV__ ? 0 : 0.2,

    integrations: Platform.OS !== 'web' ? [
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
      }),
      Sentry.feedbackIntegration(),
    ] : [],

    beforeSend(event) {
      // Safety net: drop any event where every stack frame is from app:/// —
      // that's an IAB-injected script, not our bundle.
      const frames = event.exception?.values?.[0]?.stacktrace?.frames;
      if (frames?.length && frames.every((f) => f.abs_path === 'app:///' || f.filename === 'app:///')) {
        return null;
      }

      // SecureStore Keychain read while the device is locked
      // (`errSecInteractionNotAllowed` — "User interaction is not allowed").
      // v1.37.2 moves the auth Keychain items to AFTER_FIRST_UNLOCK, gates the
      // auto-refresh ticker on foreground, and stops treating a failed read as a
      // sign-out — but builds already in the field (this first hit on 1.33.1) and
      // the residual pre-first-unlock window can still produce it, and it is now
      // handled gracefully. Match on BOTH markers so a genuine Keychain fault
      // still reports. See packages/api/src/storage.ts.
      {
        const values = event.exception?.values ?? [];
        const text = values
          .map((v) => `${v.type ?? ''} ${v.value ?? ''}`)
          .join(' ');
        if (
          /getValueWithKeyAsync/.test(text) &&
          /User interaction is not allowed/i.test(text)
        ) {
          return null;
        }
      }

      // The Turnstile fallback chain (embedded widget -> browser tab) is a working,
      // by-design recovery path, not a bug — see TurnstileWidget.tsx / useCaptchaToken.ts /
      // captchaBrowserFallback.ts.
      //
      // `turnstile_widget_failed`: the embedded widget's onError only sets a flag; the
      // browser fallback then recovers the flow. Zero user impact, high volume, and the
      // real signal is `turnstile_browser_fallback_failed`. Drop it entirely from issue
      // ingestion — TurnstileWidget.tsx still records it as a breadcrumb + Sentry log so
      // the volume stays observable in Logs.
      if (event.message === 'turnstile_widget_failed') return null;

      // `turnstile_browser_fallback_failed`: only a genuine problem when the fallback
      // could not run. User-cancelled / benign outcomes (Android `dismissed`, the iOS
      // `cancel`/`dismiss`/`locked` from ASWebAuthenticationSession, a missing token on
      // return) are normal behaviour — drop them; keep the rest at info level.
      if (event.message === 'turnstile_browser_fallback_failed') {
        const benign = new Set([
          'dismissed', 'cancel', 'dismiss', 'locked', 'opened', 'callback-missing-token',
        ]);
        if (benign.has(String(event.tags?.reason ?? ''))) return null;
        event.level = 'info';
      }

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
