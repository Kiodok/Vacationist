import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { usePathname, useLocalSearchParams } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { useCaptchaFallbackStore } from '../../../stores/captchaFallbackStore';
import type { CaptchaReturnTarget } from '../../../stores/captchaFallbackStore';
import { startCaptchaBrowserFallback } from '../utils/captchaBrowserFallback';

const SITE_KEY = '0x4AAAAAADmlpH4qVMwb-i5j';

// baseUrl makes Cloudflare domain validation pass against the configured origin.
const BASE_URL = 'https://web.vacationist.app';

// Widget must settle (token/error/expired) within this window, or we treat it as
// hung — some devices silently drop the request to challenges.cloudflare.com with
// no network error and no Turnstile callback ever firing. No embedded retries: the
// failure mode observed in practice (stale/incompatible system WebView) is
// deterministic, not transient, so a retry just delays reaching the working
// system-browser fallback — fall back after the first failed attempt.
const WATCHDOG_MS = 15000;
const MAX_ATTEMPTS = 1;

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;display:flex;justify-content:center}</style>
</head>
<body>
<div id="c"></div>
<script>
var settled = false;
function post(msg){window.ReactNativeWebView.postMessage(JSON.stringify(msg))}
function markSettled(){settled = true}

window.onerror = function(message){
  post({type:'diagnostic', reason:'js-error', detail: String(message)});
};

function onReady(){
  try {
    turnstile.render('#c',{
      sitekey:'${SITE_KEY}',
      appearance:'interaction-only',
      'refresh-expired':'auto',
      callback:function(t){markSettled();post({type:'token',token:t})},
      'error-callback':function(){markSettled();post({type:'error'})},
      'expired-callback':function(){markSettled();post({type:'expired'})}
    });
  } catch (err) {
    post({type:'diagnostic', reason:'render-threw', detail: String(err && err.message || err)});
  }
}

var s = document.createElement('script');
s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onReady&render=explicit';
s.async = true;
s.onerror = function(){
  post({type:'diagnostic', reason:'script-load-error'});
};
document.body.appendChild(s);

setTimeout(function(){
  if (!settled) post({type:'diagnostic', reason:'timeout'});
}, ${WATCHDOG_MS});
</script>
</body>
</html>`;

interface Props {
  onToken: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
  // Bump to discard a delivered/failed result and mount a fresh challenge.
  // Turnstile tokens are single-use, so callers must request a new one after
  // every consumption attempt (success or failure) before submitting again.
  resetNonce?: number;
}

// Flattens expo-router's string | string[] param values, drops undefined
// entries, and strips turnstile_token so a stray query param never gets echoed
// back into itself when returnTo is later replayed via router.replace.
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

export function TurnstileWidget({ onToken, onExpired, onError, resetNonce }: Props) {
  const [attempt, setAttempt] = useState(0);
  // Once a result has been delivered, stay rendered as null forever — otherwise
  // consuming a resolved token (which flips the store back to idle) would let
  // the embedded WebView mount again and start a second challenge.
  const [delivered, setDelivered] = useState<'none' | 'token' | 'failed'>('none');
  const lastDetail = useRef<string | undefined>(undefined);
  const fallenBack = useRef(false);

  // Call sites pass inline arrow functions, so these are captured in a ref
  // (updated every render) rather than depended on directly by effects below.
  const callbacks = useRef({ onToken, onExpired, onError });
  callbacks.current = { onToken, onExpired, onError };

  const pathname = usePathname();
  const localParams = useLocalSearchParams();
  const returnTarget = useRef<CaptchaReturnTarget>({ pathname, params: {} });
  returnTarget.current = { pathname, params: normalizeParams(localParams as Record<string, unknown>) };

  const status = useCaptchaFallbackStore((s) => s.status);

  // Reconciles this (possibly freshly mounted) instance against a browser
  // fallback result that may have been produced by an entirely different,
  // now-unmounted instance — the state lives in the store precisely so this
  // works regardless of which instance is around when the result arrives.
  useEffect(() => {
    if (delivered !== 'none') return;
    if (status === 'resolved') {
      const token = useCaptchaFallbackStore.getState().consumeToken();
      if (token) {
        setDelivered('token');
        callbacks.current.onToken(token);
      }
    } else if (status === 'failed') {
      useCaptchaFallbackStore.getState().consumeFailure();
      setDelivered('failed');
      callbacks.current.onError?.();
    }
  }, [status, delivered]);

  // Caller bumped resetNonce (after consuming or failing to consume a
  // delivered token) — remount for a fresh challenge. Skipped while a browser
  // fallback is pending/resolved so this can't race the reconciliation effect
  // above or open a second Custom Tab.
  const prevResetNonce = useRef(resetNonce);
  useEffect(() => {
    if (resetNonce === undefined || resetNonce === prevResetNonce.current) return;
    prevResetNonce.current = resetNonce;
    if (status === 'pending' || status === 'resolved') return;
    fallenBack.current = false;
    lastDetail.current = undefined;
    setDelivered('none');
    setAttempt((a) => a + 1);
  }, [resetNonce, status]);

  async function retryOrFail(reason: string) {
    if (fallenBack.current) return;
    if (attempt + 1 < MAX_ATTEMPTS) {
      setAttempt((a) => a + 1);
      return;
    }
    fallenBack.current = true;
    Sentry.captureMessage('turnstile_widget_failed', {
      level: 'warning',
      tags: { source: 'turnstile', reason },
      extra: { detail: lastDetail.current },
    });

    const result = await startCaptchaBrowserFallback(returnTarget.current);
    if (result === 'started' || result === 'busy') return; // outcome arrives via the store effect above
    setDelivered('failed');
    callbacks.current.onError?.();
  }

  function handleMessage(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as {
        type: string;
        token?: string;
        reason?: string;
        detail?: string;
      };
      if (msg.type === 'token' && msg.token) {
        setDelivered('token');
        callbacks.current.onToken(msg.token);
      } else if (msg.type === 'expired') {
        callbacks.current.onExpired?.();
      } else if (msg.type === 'error') {
        retryOrFail('cloudflare-error-callback');
      } else if (msg.type === 'diagnostic') {
        lastDetail.current = msg.detail;
        retryOrFail(msg.reason ?? 'unknown');
      }
    } catch {}
  }

  function handleWebViewError(e: WebViewErrorEvent) {
    lastDetail.current = JSON.stringify(e.nativeEvent);
    retryOrFail('webview-error');
  }

  // Nothing to render once a result has been delivered, while a browser
  // fallback is in flight (status 'pending'), or once one has just resolved but
  // hasn't been consumed by the effect yet — in every one of these cases the
  // embedded WebView must not mount (or re-mount) a fresh challenge.
  if (delivered !== 'none' || status === 'pending' || status === 'resolved') return null;

  return (
    <WebView
      key={attempt}
      source={{ html: HTML, baseUrl: BASE_URL }}
      onMessage={handleMessage}
      onError={handleWebViewError}
      javaScriptEnabled
      domStorageEnabled
      style={styles.widget}
      originWhitelist={['*']}
    />
  );
}

const styles = StyleSheet.create({
  // Turnstile refuses to initialize (and appearance:'interaction-only' can't do its
  // job) if its container is zero-sized or invisible — must stay real dimensions.
  widget: { width: 300, height: 65, alignSelf: 'center' },
});
