import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useLocalSearchParams } from 'expo-router';
import { useCaptchaFallbackStore } from '../../../stores/captchaFallbackStore';
import type { CaptchaReturnTarget } from '../../../stores/captchaFallbackStore';
import { startCaptchaBrowserFallback } from '../utils/captchaBrowserFallback';

// Most sign-in controls are not gated on the captcha (see join.tsx /
// GuestUpgradeSheet.tsx, and the magic-link controls in login.tsx) — the
// embedded widget runs invisibly in the background from mount, so by the
// time a user actually taps submit a token is very often already sitting in
// tokenRef. This budget only covers the rare case where it isn't there yet.
// The web Google button in login.tsx is the one exception — it stays gated
// on `passed` below, because the web OAuth redirect it triggers has no
// server-side captcha check at all.
const EMBEDDED_WAIT_MS = 5000;

// Flattens expo-router's string | string[] param values, drops undefined
// entries, and strips turnstile_token so a stray query param never gets
// echoed back into itself when returnTo is later replayed via router.replace.
function normalizeParams(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'turnstile_token') continue;
    if (Array.isArray(value)) {
      if (value[0] !== undefined) out[key] = String(value[0]);
    } else if (value !== undefined) {
      out[key] = String(value);
    }
  }
  return out;
}

export interface UseCaptchaTokenResult {
  // Spread directly onto <TurnstileWidget>.
  widgetProps: {
    resetNonce: number;
    onToken: (token: string) => void;
    onExpired: () => void;
    onError: () => void;
  };
  // True while a submit is actively waiting on a token — either the ≤5s
  // embedded-widget budget, or (if that didn't deliver) the full browser
  // fallback round trip, including the time spent in the Custom Tab / auth
  // session and the deep-link return. Covering the whole round trip is what
  // lets getToken() resume the caller's original action (e.g. opening the
  // Google popup) the instant the app regains focus, with no second tap.
  verifying: boolean;
  // True once verification has failed with no automatic recovery in flight.
  error: boolean;
  // True from the first successful embedded-widget or fallback token onward,
  // for the life of this hook instance — never reset by consumeToken(). Web
  // only: gates the Google button (see login.tsx) so it isn't reachable
  // before Turnstile has run at all, since Supabase's captcha protection
  // does not cover the OAuth redirect endpoint. Deliberately sticky rather
  // than tied to tokenRef, which consumeToken() clears after every submit —
  // otherwise the button would vanish again after a dismissed Google popup.
  passed: boolean;
  // Call at the top of a submit handler. Resolves with a token once one
  // becomes available — immediately if already in hand, after the embedded
  // widget delivers one, or after the browser fallback completes. Resolves
  // to undefined only on genuine failure (dismissed, timed out, or the
  // browser couldn't be opened at all) — callers should just return without
  // submitting in that case; `error` reflects it for the UI.
  getToken: () => Promise<string | undefined>;
  // Call in a `finally` around every consumption attempt (success or
  // failure) — Turnstile tokens are single-use.
  consumeToken: () => void;
}

export function useCaptchaToken(): UseCaptchaTokenResult {
  const [resetNonce, setResetNonce] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(false);
  const [passed, setPassed] = useState(false);

  const tokenRef = useRef<string | undefined>(undefined);
  const failedRef = useRef(false);
  const waiterRef = useRef<((token: string | undefined) => void) | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const pathname = usePathname();
  const localParams = useLocalSearchParams();
  const returnTarget = useRef<CaptchaReturnTarget>({ pathname, params: {} });
  returnTarget.current = { pathname, params: normalizeParams(localParams as Record<string, unknown>) };

  const onToken = useCallback((token: string) => {
    tokenRef.current = token;
    failedRef.current = false;
    if (mountedRef.current) {
      setError(false);
      setPassed(true);
    }
    if (waiterRef.current) {
      waiterRef.current(token);
      waiterRef.current = null;
    }
  }, []);

  const onExpired = useCallback(() => {
    tokenRef.current = undefined;
  }, []);

  const onError = useCallback(() => {
    // Don't resolve an in-flight waiter here — its own timeout (below) is
    // what decides to fall back. Resolving immediately on a widget error
    // would hand off to the browser mid-wait, before the user has actually
    // tried to submit anything.
    failedRef.current = true;
  }, []);

  const consumeToken = useCallback(() => {
    tokenRef.current = undefined;
    failedRef.current = false;
    setError(false);
    setResetNonce((n) => n + 1);
  }, []);

  // Waits for an in-flight (or about-to-start) browser fallback to settle,
  // consuming whatever it delivers. A plain Promise, not tied to any
  // component staying mounted — Expo Router reuses the screen instance that
  // started the fallback (see captcha-callback.tsx's router.back()), so the
  // async submit handler awaiting getToken() is almost always still alive
  // when this resolves.
  function waitForFallbackResult(): Promise<string | undefined> {
    return new Promise((resolve) => {
      const settle = (token: string | undefined) => {
        unsub();
        resolve(token);
      };
      const unsub = useCaptchaFallbackStore.subscribe((state) => {
        if (state.status === 'resolved') {
          settle(useCaptchaFallbackStore.getState().consumeToken() ?? undefined);
        } else if (state.status === 'failed') {
          useCaptchaFallbackStore.getState().consumeFailure();
          settle(undefined);
        }
      });
    });
  }

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (tokenRef.current) return tokenRef.current;

    // A fallback may have already resolved with nobody left to consume it —
    // e.g. the OS killed the app while the Custom Tab was open and the deep
    // link cold-started a fresh instance (see captcha-callback.tsx), so the
    // original getToken() call that started it no longer exists.
    const leftover = useCaptchaFallbackStore.getState();
    if (leftover.status === 'resolved') {
      const token = leftover.consumeToken();
      if (token) return token;
    } else if (leftover.status === 'failed') {
      leftover.consumeFailure();
    }

    const skipEmbeddedWait = failedRef.current;
    failedRef.current = false;

    if (!skipEmbeddedWait) {
      setVerifying(true);
      const token = await new Promise<string | undefined>((resolve) => {
        waiterRef.current = resolve;
        setTimeout(() => {
          if (waiterRef.current === resolve) {
            waiterRef.current = null;
            resolve(undefined);
          }
        }, EMBEDDED_WAIT_MS);
      });
      if (token) {
        if (mountedRef.current) setVerifying(false);
        return token;
      }
    }

    // No token yet — remount the embedded widget so it gets a fresh attempt
    // next time, and hand off to the browser fallback now.
    setResetNonce((n) => n + 1);
    if (mountedRef.current) setVerifying(true);

    const startResult = await startCaptchaBrowserFallback(returnTarget.current);
    if (startResult === 'open-failed') {
      if (mountedRef.current) {
        setVerifying(false);
        setError(true);
      }
      return undefined;
    }

    // 'started': this call's own fallback. 'busy': another call already has
    // one in flight — piggyback on it rather than opening a second tab.
    const fallbackToken = await waitForFallbackResult();
    if (mountedRef.current) {
      setVerifying(false);
      if (!fallbackToken) setError(true);
    }
    return fallbackToken;
  }, []);

  return {
    widgetProps: { resetNonce, onToken, onExpired, onError },
    verifying,
    error,
    passed,
    getToken,
    consumeToken,
  };
}
