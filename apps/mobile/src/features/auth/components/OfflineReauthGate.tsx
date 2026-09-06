import { useEffect, useState } from 'react';
import { BackHandler, Modal, Platform, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { Button, useThemeColors, ThemedIcon } from '@vacationist/ui';
import { readStoredSession } from '@vacationist/api';
import { useAuthStore } from '../../../stores/authStore';
import { loadUserFromCache } from '../../../utils/userCache';
import { setSentryUser } from '../../../utils/sentry';
import { extendOfflineWindow } from '../utils/authSnapshot';
import type { User } from '@vacationist/types';

function minimalUser(id: string): User {
  return {
    id,
    name: '',
    email: null,
    avatar_url: null,
    locale: null,
    timezone: 'UTC',
    is_guest: false,
    preferred_currency: null,
    show_store_badges: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

/**
 * Shown (Phase 19) when the app launches offline, credentials are still on disk,
 * but the 7-day offline trust window has lapsed. A biometric / device-PIN check
 * grants another window and lets the user back into their cached trip data —
 * there is never a hard lockout while there's no network. Reconnecting also
 * clears this gate automatically (the auth-refresh ticker fires SIGNED_IN →
 * useAuthInit's onAuthStateChange handler).
 */
export function OfflineReauthGate() {
  const { t } = useTranslation('auth');
  const colors = useThemeColors();
  const required = useAuthStore((s) => s.offlineReauthRequired);
  const setHasSession = useAuthStore((s) => s.setHasSession);
  const setUser = useAuthStore((s) => s.setUser);
  const setOfflineReauthRequired = useAuthStore((s) => s.setOfflineReauthRequired);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Block the Android hardware back button while the gate is up.
  useEffect(() => {
    if (!required) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [required]);

  async function enterApp() {
    const stored = await readStoredSession();
    if (!stored) {
      // Credentials vanished under us — fall through to the login screen.
      setOfflineReauthRequired(false);
      return;
    }
    await extendOfflineWindow(stored.userId);
    const cached = loadUserFromCache();
    setUser(cached ?? minimalUser(stored.userId));
    if (cached) setSentryUser(cached.id, cached.locale);
    setHasSession(true);
    setOfflineReauthRequired(false);
  }

  async function handleConfirm() {
    setFailed(false);
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        await enterApp();
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('offlineReauth.prompt'),
        disableDeviceFallback: false,
        cancelLabel: t('offlineReauth.cancel'),
      });
      if (result.success) {
        await enterApp();
        return;
      }
      // No biometrics / PIN configured — nothing to check against, so let them in.
      if (result.error === 'not_enrolled' || result.error === 'not_available') {
        await enterApp();
        return;
      }
      // user_cancel / lockout / system_cancel — stay on the gate, offer retry.
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (!required) return null;

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View className="flex-1 bg-background items-center justify-center px-xl">
        <View className="items-center gap-lg w-full">
          <View className="w-[80px] h-[80px] rounded-full bg-primary/10 items-center justify-center">
            <ThemedIcon name="lock-closed-outline" size={44} color={colors.primary} />
          </View>
          <Text className="text-2xl font-bold text-text-primary text-center">
            {t('offlineReauth.title')}
          </Text>
          <Text className="text-body text-text-secondary text-center leading-relaxed">
            {t('offlineReauth.body')}
          </Text>
          <Button
            label={t('offlineReauth.confirm')}
            onPress={handleConfirm}
            variant="primary"
            className="w-full mt-md"
            disabled={busy}
          />
          {failed && (
            <Text className="text-body text-danger text-center">
              {t('offlineReauth.retry')}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
