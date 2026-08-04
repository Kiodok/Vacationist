import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import * as Sentry from '@sentry/react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

const SITE_KEY = '0x4AAAAAADmlpH4qVMwb-i5j';

// baseUrl makes Cloudflare domain validation pass against the configured origin.
const BASE_URL = 'https://web.vacationist.app';

// Fallback target when the embedded WebView can't render Turnstile at all (e.g. a
// device stuck on a very old system WebView). Runs the challenge in the device's
// real, independently-updated browser engine (Custom Tabs / ASWebAuthenticationSession)
// instead. Uses a distinct `turnstile_token` query param — not `token` — so it can
// never collide with the app's own invite-token deep-link handler in app/_layout.tsx.
const CAPTCHA_PAGE_URL = 'https://web.vacationist.app/captcha-redirect';

// Avoids relying on the WHATWG URL/URLSearchParams globals, which aren't used
// elsewhere in this codebase's native paths and aren't guaranteed complete on
// Hermes without a polyfill this app doesn't include.
function getQueryParam(url: string, key: string): string | null {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return null;
  const query = url.slice(queryStart + 1).split('#')[0];
  for (const pair of query.split('&')) {
    const [k, v] = pair.split('=');
    if (decodeURIComponent(k) === key) return v ? decodeURIComponent(v) : '';
  }
  return null;
}

async function openTurnstileInBrowser(): Promise<string | null> {
  const redirectUri = makeRedirectUri({ path: 'captcha-callback' });
  const authUrl = `${CAPTCHA_PAGE_URL}?redirect_uri=${encodeURIComponent(redirectUri)}`;
  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type === 'success' && result.url) {
      return getQueryParam(result.url, 'turnstile_token');
    }
  } catch {
    // Fall through to null — treated as a failed fallback by the caller.
  }
  return null;
}

// Widget must settle (token/error/expired) within this window, or we treat it as
// hung — some devices silently drop the request to challenges.cloudflare.com with
// no network error and no Turnstile callback ever firing. Kept low (2 attempts,
// ~30s) since the failure mode observed in practice (stale/incompatible system
// WebView) is deterministic, not transient — extra embedded retries just delay
// reaching the working system-browser fallback.
const WATCHDOG_MS = 15000;
const MAX_ATTEMPTS = 2;

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
}

export function TurnstileWidget({ onToken, onExpired, onError }: Props) {
  const [attempt, setAttempt] = useState(0);
  const lastDetail = useRef<string | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  function retryOrFail(reason: string) {
    if (attempt + 1 < MAX_ATTEMPTS) {
      setAttempt((a) => a + 1);
      return;
    }
    Sentry.captureMessage('turnstile_widget_failed', {
      level: 'warning',
      tags: { source: 'turnstile', reason },
      extra: { detail: lastDetail.current },
    });
    fallbackToBrowser();
  }

  async function fallbackToBrowser() {
    const token = await openTurnstileInBrowser();
    if (!mounted.current) return;
    if (token) {
      onToken(token);
    } else {
      Sentry.captureMessage('turnstile_browser_fallback_failed', {
        level: 'warning',
        tags: { source: 'turnstile' },
      });
      onError?.();
    }
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
        onToken(msg.token);
      } else if (msg.type === 'expired') {
        onExpired?.();
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
