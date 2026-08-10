import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Input, useThemeColors } from '@vacationist/ui';
import { signInWithMagicLink } from '@vacationist/api';
import { useToastStore } from '../../src/stores/toastStore';
import { useGoogleSignIn } from '../../src/features/auth/hooks/useGoogleSignIn';
import { useAppleSignIn } from '../../src/features/auth/hooks/useAppleSignIn';
import { useCaptchaToken } from '../../src/features/auth/hooks/useCaptchaToken';
import { GoogleAuthButton } from '../../src/features/auth/components/GoogleAuthButton';
import { AppleAuthButton } from '../../src/features/auth/components/AppleAuthButton';
import { TurnstileWidget } from '../../src/features/auth/components/TurnstileWidget';

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const captcha = useCaptchaToken();
  const colors = useThemeColors();
  const showGoogleButton = Platform.OS !== 'web' || captcha.passed;

  const { signIn: handleGoogleSignIn, loading: googleLoading } =
    useGoogleSignIn((msg) => addToast('error', msg));
  const { signIn: handleAppleSignIn, loading: appleLoading } =
    useAppleSignIn((msg) => addToast('error', msg));

  async function handleGoogleUpgrade() {
    const captchaToken = await captcha.getToken();
    if (!captchaToken) return;
    try {
      await handleGoogleSignIn(captchaToken);
    } finally {
      captcha.consumeToken();
    }
  }

  async function handleAppleUpgrade() {
    const captchaToken = await captcha.getToken();
    if (!captchaToken) return;
    try {
      await handleAppleSignIn(captchaToken);
    } finally {
      captcha.consumeToken();
    }
  }

  async function handleMagicLink() {
    setEmailError('');
    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(t('login.invalidEmail'));
      return;
    }

    setMagicLinkLoading(true);
    const captchaToken = await captcha.getToken();
    if (!captchaToken) {
      setMagicLinkLoading(false);
      return;
    }
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
      captcha.consumeToken();
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
          {showGoogleButton ? (
            <>
              {Platform.OS === 'ios' && (
                <AppleAuthButton
                  onPress={handleAppleUpgrade}
                  loading={appleLoading}
                  disabled={googleLoading || magicLinkLoading || captcha.verifying}
                />
              )}

              <GoogleAuthButton
                onPress={handleGoogleUpgrade}
                loading={googleLoading}
                disabled={appleLoading || magicLinkLoading || captcha.verifying}
              />

              <View className="flex-row items-center gap-md my-sm">
                <View className="flex-1 h-[1px] bg-border" />
                <Text className="text-body-small text-text-muted">
                  {t('login.orContinueWith')}
                </Text>
                <View className="flex-1 h-[1px] bg-border" />
              </View>
            </>
          ) : !captcha.error ? (
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
            disabled={googleLoading || appleLoading || magicLinkLoading || captcha.verifying}
          />

          <TurnstileWidget {...captcha.widgetProps} />

          {captcha.verifying && (
            <Text className="text-body-small text-text-muted text-center">
              {tCommon('captcha.verifying')}
            </Text>
          )}

          {captcha.error && (
            <Text className="text-body-small text-danger text-center">
              {tCommon('captcha.error')}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
