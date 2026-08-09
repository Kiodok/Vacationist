import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import * as Sentry from '@sentry/react-native';

// Real HTTPS origin, hosted at apps/mobile/public/captcha-embed.html and
// served by Vercel. Loaded by URI — NOT injected as inline html+baseUrl.
// Turnstile has no official WebView support, and loadDataWithBaseURL (the
// old approach here) does not give the document a normal security origin,
// which is what broke Turnstile's cookie handling and cross-origin frame
// access on Android in practice. web.vacationist.app is already an
// allowlisted Turnstile domain.
const EMBED_URL = 'https://web.vacationist.app/captcha-embed.html';

interface Props {
  onToken: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
  // Bump to mount a fresh challenge. Turnstile tokens are single-use, so
  // callers must request a new one after every consumption attempt (success
  // or failure) before submitting again.
  resetNonce?: number;
}

// Orchestration (deciding *when* a failure should hand off to the browser
// fallback, and waiting on the result) lives in useCaptchaToken — this
// component only reports what actually happened to the embedded challenge.
export function TurnstileWidget({ onToken, onExpired, onError, resetNonce }: Props) {
  function reportFailure(reason: string, detail?: string) {
    Sentry.captureMessage('turnstile_widget_failed', {
      level: 'warning',
      tags: { source: 'turnstile', reason },
      extra: { detail },
    });
    onError?.();
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
        reportFailure('cloudflare-error-callback');
      } else if (msg.type === 'diagnostic') {
        reportFailure(msg.reason ?? 'unknown', msg.detail);
      }
    } catch {}
  }

  function handleWebViewError(e: WebViewErrorEvent) {
    reportFailure('webview-error', JSON.stringify(e.nativeEvent));
  }

  return (
    <WebView
      key={resetNonce ?? 0}
      source={{ uri: EMBED_URL }}
      onMessage={handleMessage}
      onError={handleWebViewError}
      javaScriptEnabled
      domStorageEnabled
      style={styles.widget}
      pointerEvents="none"
      originWhitelist={['*']}
    />
  );
}

const styles = StyleSheet.create({
  // Invisible-mode Turnstile draws nothing, but the widget still refuses to
  // initialize in a zero-sized or display:none container (confirmed on the
  // web widget previously) — keep real dimensions, just moved off-screen
  // instead of shrunk, so it never affects layout.
  widget: { position: 'absolute', width: 300, height: 65, top: -9999, left: -9999, opacity: 0 },
});
