import { AppState, Platform } from 'react-native';
import type { AppStateStatus, NativeEventSubscription } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Sentry from '@sentry/react-native';
import { useCaptchaFallbackStore } from '../../../stores/captchaFallbackStore';
import type { CaptchaReturnTarget } from '../../../stores/captchaFallbackStore';

// Fallback target for a rare embedded-widget failure (e.g. a device stuck on
// a very old system WebView that still can't render even the real-origin,
// invisible-mode challenge). Runs it in the device's real, independently-
// updated browser engine instead. Only ever called from useCaptchaToken's
// getToken() — after a definite widget failure or a short wait times out on
// submit, never automatically on mount. The web page here is unrelated to
// this platform split below — it's the same page either way.
const CAPTCHA_PAGE_URL = 'https://web.vacationist.app/captcha-redirect';
const CALLBACK_PATH = 'captcha-callback';

// On Android, openBrowserAsync gives no dismissal signal (dismissBrowser is
// iOS-only in expo-web-browser), so we own "the user backed out" detection via
// AppState. The grace period exists because the *success* path also
// backgrounds/foregrounds the app right before the callback route mounts and
// resolves the store — too short here would misreport a normal, slightly slow
// return as a cancel.
const DISMISS_GRACE_MS = 2000;
// Safety net in case AppState events are ever missed entirely.
const ABSOLUTE_TIMEOUT_MS = 300_000;

export type StartFallbackResult = 'started' | 'busy' | 'open-failed';

// Extracts a query param from a redirect URL without relying on the WHATWG
// URL/URLSearchParams globals, which aren't guaranteed complete on Hermes
// without a polyfill this app doesn't include.
export function getTurnstileTokenFromUrl(url: string): string | null {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return null;
  const query = url.slice(queryStart + 1).split('#')[0];
  for (const pair of query.split('&')) {
    const [k, v] = pair.split('=');
    if (decodeURIComponent(k) === 'turnstile_token') return v ? decodeURIComponent(v) : '';
  }
  return null;
}

function failFallback(reason: string) {
  useCaptchaFallbackStore.getState().fail(reason);
  Sentry.captureMessage('turnstile_browser_fallback_failed', {
    level: 'warning',
    tags: { source: 'turnstile', reason },
  });
}

// Module-level (not component-scoped) watchdog state — the whole point is that
// none of this depends on any particular TurnstileWidget instance staying
// mounted, since the screen that started the fallback can legitimately be torn
// down and rebuilt while the browser tab is open.
let appStateSub: NativeEventSubscription | null = null;
let linkingSub: { remove: () => void } | null = null;
let graceTimer: ReturnType<typeof setTimeout> | null = null;
let absoluteTimer: ReturnType<typeof setTimeout> | null = null;
let storeUnsub: (() => void) | null = null;
let sawBackground = false;

function cleanupWatchdogs() {
  appStateSub?.remove();
  appStateSub = null;
  linkingSub?.remove();
  linkingSub = null;
  if (graceTimer) clearTimeout(graceTimer);
  graceTimer = null;
  if (absoluteTimer) clearTimeout(absoluteTimer);
  absoluteTimer = null;
  storeUnsub?.();
  storeUnsub = null;
  sawBackground = false;
}

function installAndroidWatchdogs(redirectUri: string) {
  storeUnsub = useCaptchaFallbackStore.subscribe((state) => {
    if (state.status !== 'pending') cleanupWatchdogs();
  });

  appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'background' || next === 'inactive') {
      sawBackground = true;
      return;
    }
    if (next === 'active' && sawBackground) {
      if (graceTimer) clearTimeout(graceTimer);
      graceTimer = setTimeout(() => {
        if (useCaptchaFallbackStore.getState().status === 'pending') {
          failFallback('dismissed');
        }
      }, DISMISS_GRACE_MS);
    }
  });

  // Redundant token capture alongside the callback route — this never navigates,
  // it only writes to the store, so it can't race Expo Router's own navigation
  // the way the old openAuthSessionAsync polyfill did. Defense in depth in case
  // the callback route is ever not reached for some reason.
  linkingSub = Linking.addEventListener('url', (event: { url: string }) => {
    if (!event.url.startsWith(redirectUri)) return;
    const token = getTurnstileTokenFromUrl(event.url);
    if (token) useCaptchaFallbackStore.getState().resolve(token);
  });

  absoluteTimer = setTimeout(() => {
    if (useCaptchaFallbackStore.getState().status === 'pending') {
      failFallback('timeout');
    }
  }, ABSOLUTE_TIMEOUT_MS);
}

export async function startCaptchaBrowserFallback(
  returnTo: CaptchaReturnTarget | null,
): Promise<StartFallbackResult> {
  const store = useCaptchaFallbackStore.getState();

  // Concurrency guard against a genuine double-invoke (e.g. two hook
  // instances both deciding to fall back at once) — a second Custom Tab
  // never opens while one is already pending. There is no time-based
  // cooldown on top of this: the fallback is exclusively triggered from a
  // deliberate submit tap (see useCaptchaToken.ts), so a fresh call here is
  // always a fresh, legitimate user attempt, not a runaway retry loop.
  if (store.status === 'pending') return 'busy';

  store.begin(returnTo);

  const redirectUri = makeRedirectUri({ path: CALLBACK_PATH });
  const authUrl = `${CAPTCHA_PAGE_URL}?redirect_uri=${encodeURIComponent(redirectUri)}`;

  if (Platform.OS === 'android') {
    installAndroidWatchdogs(redirectUri);
    try {
      await WebBrowser.openBrowserAsync(authUrl);
    } catch {
      cleanupWatchdogs();
      failFallback('open-failed');
      return 'open-failed';
    }
    // openBrowserAsync resolving on Android just means the tab was opened, not
    // that it was closed — the outcome (token or dismissal) arrives later via
    // the callback route / AppState watchdog / Linking capture above.
    return 'started';
  }

  // iOS/other: openAuthSessionAsync is natively supported here
  // (ASWebAuthenticationSession), so there's no Linking-based race with Expo
  // Router's own navigation — the promise resolving directly is reliable.
  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type === 'success' && result.url) {
      const token = getTurnstileTokenFromUrl(result.url);
      if (token) {
        useCaptchaFallbackStore.getState().resolve(token);
      } else {
        failFallback('callback-missing-token');
      }
    } else {
      failFallback(result.type);
    }
  } catch {
    failFallback('open-failed');
    return 'open-failed';
  }
  return 'started';
}
