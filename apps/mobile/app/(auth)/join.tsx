import { useState, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Input, colors, ThemedIcon } from '@vacationist/ui';
import { signInAnonymously, redeemInviteToken } from '@vacationist/api';
import { useToastStore } from '../../src/stores/toastStore';
import { useAuthStore } from '../../src/stores/authStore';
import { TurnstileWidget } from '../../src/features/auth/components/TurnstileWidget';

export default function JoinScreen() {
  const { t } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const setPendingInviteToken = useAuthStore((s) => s.setPendingInviteToken);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaError, setCaptchaError] = useState(false);
  const turnstileToken = useRef<string | undefined>(undefined);

  async function handleJoinAsGuest() {
    if (!captchaReady) return;
    setNameError('');
    const trimmed = name.trim();

    if (!trimmed) {
      setNameError(t('join.nameRequired'));
      return;
    }

    if (trimmed.length > 100) {
      setNameError(t('join.nameTooLong'));
      return;
    }

    setLoading(true);
    try {
      await signInAnonymously({ name: trimmed }, turnstileToken.current);
      turnstileToken.current = undefined;

      if (token) {
        try {
          const tripId = await redeemInviteToken(token);
          router.replace({ pathname: '/trip/[id]', params: { id: tripId } } as never);
          return;
        } catch (err) {
          const message = err instanceof Error ? err.message : t('invite.invalid');
          addToast('error', message);
          setLoading(false);
          return;
        }
      }
    } catch {
      addToast('error', t('join.failed'));
      setLoading(false);
    }
  }

  function handleSignInInstead() {
    if (token) {
      setPendingInviteToken(token);
      if (Platform.OS === 'web') {
        try { sessionStorage.setItem('pendingInviteToken', token); } catch {}
      }
    }
    router.replace('/(auth)/login');
  }

  return (
    <SafeAreaView className="flex-1 bg-background justify-center px-lg">
      <View className="items-center gap-lg">
        <View className="w-[64px] h-[64px] rounded-full bg-primary-muted items-center justify-center">
          <ThemedIcon name="people-outline" size={32} color={colors.primary} />
        </View>

        <Text className="text-heading-l text-text-primary text-center">
          {t('join.title')}
        </Text>

        <Text className="text-body text-text-secondary text-center">
          {t('join.subtitle')}
        </Text>

        <View className="w-full gap-md mt-md">
          <Input
            label={t('join.nameLabel')}
            placeholder={t('join.namePlaceholder')}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError('');
            }}
            error={nameError}
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="go"
            onSubmitEditing={handleJoinAsGuest}
          />

          <Button
            label={t('join.submit')}
            onPress={handleJoinAsGuest}
            loading={loading}
            disabled={loading || !captchaReady}
          />

          <TurnstileWidget
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

          <Button
            label={t('join.signInInstead')}
            variant="ghost"
            onPress={handleSignInInstead}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
