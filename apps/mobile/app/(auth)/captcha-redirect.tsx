import { Platform, View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TurnstileWidget } from '../../src/features/auth/components/TurnstileWidget';

// Web-only target page for the Chrome Custom Tab / ASWebAuthenticationSession
// fallback, triggered from useCaptchaToken.ts only after a definite embedded-
// widget failure or a short submit-time wait timing out (never automatically
// on mount) — e.g. a device stuck on a very old system WebView that still
// can't render even the real-origin, invisible-mode challenge. Runs
// Turnstile in the device's real, independently-updated browser engine
// instead.
//
// This page IS the recovery path — if the invisible Turnstile challenge here
// also hangs (observed in practice: no token, no error, nothing), the user
// has no way back into the app short of force-closing the browser. The
// watchdog below guarantees a visible retry option instead of an indefinite
// "Verifying…" with nothing to do.
const WATCHDOG_MS = 12000;

export default function CaptchaRedirectScreen() {
  const { t } = useTranslation('auth');
  const { redirect_uri: redirectUri } = useLocalSearchParams<{ redirect_uri?: string }>();
  const [status, setStatus] = useState<'pending' | 'stalled' | 'error'>('pending');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!redirectUri || status !== 'pending') return;
    const timer = setTimeout(() => setStatus('stalled'), WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [redirectUri, status, attempt]);

  function handleToken(token: string) {
    if (Platform.OS !== 'web' || !redirectUri) return;
    const separator = redirectUri.includes('?') ? '&' : '?';
    window.location.href = `${redirectUri}${separator}turnstile_token=${encodeURIComponent(token)}`;
  }

  function handleRetry() {
    // Remounts TurnstileWidget (key={attempt}) for a fresh challenge. Stays
    // mounted (not unmounted) while merely "stalled" so a late success from
    // the original attempt can still land right up until the user retries.
    setStatus('pending');
    setAttempt((a) => a + 1);
  }

  return (
    <SafeAreaView className="flex-1 bg-background justify-center items-center px-lg">
      <View className="items-center gap-lg">
        <Text className="text-body text-text-primary text-center">
          {!redirectUri
            ? t('captchaRedirect.missingRedirect')
            : status === 'error'
              ? t('captchaRedirect.failed')
              : status === 'stalled'
                ? t('captchaRedirect.stalled')
                : t('captchaRedirect.verifying')}
        </Text>

        {(status === 'stalled' || status === 'error') && redirectUri && (
          <Pressable onPress={handleRetry} hitSlop={12}>
            <Text className="text-body text-primary font-semibold">
              {t('captchaRedirect.retry')}
            </Text>
          </Pressable>
        )}

        {redirectUri && status !== 'error' && (
          <TurnstileWidget key={attempt} onToken={handleToken} onError={() => setStatus('error')} />
        )}
      </View>
    </SafeAreaView>
  );
}
