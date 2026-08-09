import { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@vacationist/ui';
import { useAuthStore } from '../../src/stores/authStore';
import { useCaptchaFallbackStore } from '../../src/stores/captchaFallbackStore';

// Authoritative landing point for the native CAPTCHA browser fallback's deep
// link (vacationist://captcha-callback?turnstile_token=...) — see
// useCaptchaToken.ts / captchaBrowserFallback.ts. This fallback only ever
// starts from a submit handler now (a definite embedded-widget failure, or a
// short wait timing out), never automatically on mount. Registering this as
// a real route (instead of letting it fall through to +not-found) is what
// stops the browser-fallback loop: without it, Expo Router's own automatic
// deep-link navigation tears down whatever screen started the CAPTCHA
// request before the token can be delivered.
export default function CaptchaCallbackScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const colors = useThemeColors();
  const { turnstile_token: rawToken } = useLocalSearchParams<{ turnstile_token?: string | string[] }>();
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasSession = useAuthStore((s) => s.hasSession);
  const handled = useRef(false);

  useEffect(() => {
    // Wait for auth state to resolve so the fallback destination below (used
    // only if no returnTo was stored — e.g. the app was cold-started while the
    // browser tab was open) can pick the right default.
    if (handled.current || isLoading) return;
    handled.current = true;

    const store = useCaptchaFallbackStore.getState();
    const returnTo = store.returnTo;
    if (token) {
      store.resolve(token);
    } else {
      store.fail('callback-missing-token');
    }

    // The screen that started the fallback is very often still alive underneath
    // this one (Expo Router pushes the deep-link route on top rather than
    // resetting the stack) — going back reuses that existing instance instead of
    // creating a new one, which avoids an unnecessary remount that would restart
    // the whole embedded-widget-then-fallback cycle for no reason (and, as a
    // bonus, preserves local screen state — e.g. GuestUpgradeSheet stays open).
    // router.replace() is only needed as a fallback for a genuine cold start
    // (app launched fresh directly into this deep link, nothing to go back to).
    if (router.canGoBack()) {
      router.back();
      return;
    }
    const target = returnTo ?? { pathname: hasSession ? '/(tabs)' : '/(auth)/login' };
    router.replace({ pathname: target.pathname, params: target.params } as never);
  }, [isLoading, hasSession, token, router]);

  return (
    <SafeAreaView className="flex-1 bg-background justify-center items-center px-lg">
      <View className="items-center gap-lg">
        <ActivityIndicator color={colors.primary} />
        <Text className="text-body text-text-secondary text-center">
          {t('captchaCallback.returning')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
