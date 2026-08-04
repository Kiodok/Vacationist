import { Platform, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TurnstileWidget } from '../../src/features/auth/components/TurnstileWidget';

// Web-only target page for the Chrome Custom Tab / ASWebAuthenticationSession
// fallback triggered when the embedded native WebView can't render Turnstile
// (e.g. a device stuck on a very old system WebView). Runs Turnstile in the
// device's real, independently-updated browser engine instead.
export default function CaptchaRedirectScreen() {
  const { t } = useTranslation('auth');
  const { redirect_uri: redirectUri } = useLocalSearchParams<{ redirect_uri?: string }>();
  const [error, setError] = useState(false);

  function handleToken(token: string) {
    if (Platform.OS !== 'web' || !redirectUri) return;
    const separator = redirectUri.includes('?') ? '&' : '?';
    window.location.href = `${redirectUri}${separator}turnstile_token=${encodeURIComponent(token)}`;
  }

  return (
    <SafeAreaView className="flex-1 bg-background justify-center items-center px-lg">
      <View className="items-center gap-lg">
        <Text className="text-body text-text-primary text-center">
          {!redirectUri
            ? t('captchaRedirect.missingRedirect')
            : error
              ? t('captchaRedirect.failed')
              : t('captchaRedirect.verifying')}
        </Text>
        {redirectUri && (
          <TurnstileWidget onToken={handleToken} onError={() => setError(true)} />
        )}
      </View>
    </SafeAreaView>
  );
}
