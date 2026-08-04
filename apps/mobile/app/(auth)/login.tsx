import { useState, useRef } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Input, useThemeColors } from '@vacationist/ui';
import { signInWithMagicLink } from '@vacationist/api';
import { useToastStore } from '../../src/stores/toastStore';
import { useGoogleSignIn } from '../../src/features/auth/hooks/useGoogleSignIn';
import { GoogleAuthButton } from '../../src/features/auth/components/GoogleAuthButton';
import { TurnstileWidget } from '../../src/features/auth/components/TurnstileWidget';

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaError, setCaptchaError] = useState(false);
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0);
  const turnstileToken = useRef<string | undefined>(undefined);

  const colors = useThemeColors();
  const { signIn: handleGoogleSignIn, loading: googleLoading } =
    useGoogleSignIn((msg) => addToast('error', msg));

  // Turnstile tokens are single-use — every attempt that consumes one, whether
  // it succeeds or fails, must clear it and request a fresh challenge before
  // the user can submit again.
  function consumeCaptcha() {
    turnstileToken.current = undefined;
    setCaptchaReady(false);
    setCaptchaResetNonce((n) => n + 1);
  }

  async function handleGoogleUpgrade() {
    const captchaToken = turnstileToken.current;
    try {
      await handleGoogleSignIn(captchaToken);
    } finally {
      consumeCaptcha();
    }
  }

  async function handleMagicLink() {
    if (!captchaReady) return;
    setEmailError('');
    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(t('login.invalidEmail'));
      return;
    }

    setMagicLinkLoading(true);
    const captchaToken = turnstileToken.current;
    try {
      const redirectTo = makeRedirectUri();
      await signInWithMagicLink(trimmed, redirectTo, captchaToken);
      router.push({
        pathname: '/(auth)/magic-link-sent',
        params: { email: trimmed },
      });
    } catch {
      addToast('error', t('login.magicLinkFailed'));
    } finally {
      consumeCaptcha();
      setMagicLinkLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center px-lg"
      >
        <View className="items-center mb-3xl">
          <Text className="text-heading-xl text-text-primary">Vacationist</Text>
          <Text className="text-body text-text-secondary mt-sm">
            {t('login.tagline')}
          </Text>
        </View>

        <View className="gap-md" style={{ alignSelf: 'center', width: 240 }}>
          {captchaReady ? (
            <>
              <GoogleAuthButton
                onPress={handleGoogleUpgrade}
                loading={googleLoading}
                disabled={magicLinkLoading}
              />

              <View className="flex-row items-center gap-md my-sm">
                <View className="flex-1 h-[1px] bg-border" />
                <Text className="text-body-small text-text-muted">
                  {t('login.orContinueWith')}
                </Text>
                <View className="flex-1 h-[1px] bg-border" />
              </View>
            </>
          ) : !captchaError ? (
            <View style={{ height: 48, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
            </View>
          ) : null}

          <Input
            placeholder={t('login.emailPlaceholder')}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError('');
            }}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="go"
            onSubmitEditing={handleMagicLink}
          />

          <Button
            label={t('login.sendMagicLink')}
            variant="secondary"
            onPress={handleMagicLink}
            loading={magicLinkLoading}
            disabled={googleLoading || magicLinkLoading || !captchaReady}
          />

          <TurnstileWidget
            resetNonce={captchaResetNonce}
            onToken={(token) => {
              turnstileToken.current = token;
              setCaptchaReady(true);
              setCaptchaError(false);
            }}
            onExpired={() => {
              turnstileToken.current = undefined;
              setCaptchaReady(false);
            }}
            onError={() => {
              setCaptchaReady(false);
              setCaptchaError(true);
            }}
          />

          {captchaError && (
            <Text className="text-body-small text-danger text-center">
              {tCommon('captcha.error')}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
