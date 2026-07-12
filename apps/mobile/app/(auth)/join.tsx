import { useState, useRef, useEffect } from 'react';
import { View, Text, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatDateRange } from '@vacationist/utils';
import { Button, Input, colors, ThemedIcon } from '@vacationist/ui';
import { signInAnonymously, redeemInviteToken, previewInviteToken, getSession } from '@vacationist/api';
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
  const authLoading = useAuthStore((s) => s.isLoading);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaError, setCaptchaError] = useState(false);
  const turnstileToken = useRef<string | undefined>(undefined);
  const [tripPreview, setTripPreview] = useState<{ trip_title: string; start_date: string; end_date: string } | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(!!token);

  useEffect(() => {
    if (!token) return;
    setPreviewLoading(true);
    previewInviteToken(token).then((preview) => {
      if (preview) setTripPreview(preview);
      else setTokenInvalid(true);
      setPreviewLoading(false);
    });
  }, [token]);

  // A session already exists (route-guard race, or stale tab): never create a
  // second anonymous account — hand the token to the authenticated join flow.
  function redirectSignedInUser() {
    if (token) {
      router.replace({ pathname: '/trip/join-confirm', params: { token } } as never);
    } else {
      router.replace('/(tabs)' as never);
    }
  }

  async function handleJoinAsGuest() {
    if (!captchaReady || authLoading) return;
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

    const session = await getSession().catch(() => null);
    if (session) {
      redirectSignedInUser();
      return;
    }

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
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_SIGNED_IN') {
        redirectSignedInUser();
        return;
      }
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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center px-lg"
      >
        <View className="items-center mb-3xl">
          <View className="w-[64px] h-[64px] rounded-full bg-primary-muted items-center justify-center mb-lg">
            <ThemedIcon name="people-outline" size={32} color={colors.primary} />
          </View>

          <Text className="text-heading-l text-text-primary text-center">
            {previewLoading ? ' ' : tripPreview ? tripPreview.trip_title : t('join.title')}
          </Text>

          {tripPreview && !previewLoading ? (
            <Text className="text-body text-primary text-center font-medium mt-xs">
              {t('join.tripDates', { dateRange: formatDateRange(tripPreview.start_date, tripPreview.end_date) })}
            </Text>
          ) : null}

          {tokenInvalid ? (
            <Text className="text-body-small text-danger text-center mt-xs">
              {t('join.expiredToken')}
            </Text>
          ) : null}
        </View>

        <View className="gap-md" style={{ alignSelf: 'center', width: 240 }}>
          <Button
            label={t('join.signInInstead')}
            onPress={handleSignInInstead}
          />

          <View className="flex-row items-center gap-md">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-body-small text-text-muted">{t('join.or')}</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

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
            variant="secondary"
            onPress={handleJoinAsGuest}
            loading={loading}
            disabled={loading || !captchaReady || authLoading}
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
