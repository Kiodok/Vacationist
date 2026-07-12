import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatDateRange } from '@vacationist/utils';
import { Button, ThemedIcon, useThemeColors } from '@vacationist/ui';
import { previewInviteToken, redeemInviteToken } from '@vacationist/api';
import { useToastStore } from '../../src/stores/toastStore';

export default function JoinConfirmScreen() {
  const { t } = useTranslation('auth');
  const { token: rawToken } = useLocalSearchParams<{ token: string | string[] }>();
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const colors = useThemeColors();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(!!token);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [tripPreview, setTripPreview] = useState<{
    trip_title: string;
    start_date: string;
    end_date: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenInvalid(true);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setTokenInvalid(false);
    setPreviewLoading(true);
    previewInviteToken(token)
      .then((preview) => {
        if (cancelled) return;
        if (preview) setTripPreview(preview);
        else setTokenInvalid(true);
      })
      .catch(() => {
        if (!cancelled) setTokenInvalid(true);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  async function handleJoin() {
    if (!token || loading) return;
    setLoading(true);
    try {
      const tripId = await redeemInviteToken(token);
      addToast('success', t('invite.joined'));
      router.replace({ pathname: '/trip/[id]', params: { id: tripId } } as never);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('invite.invalid');
      addToast('error', message);
      setLoading(false);
    }
  }

  function handleCancel() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as never);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center px-lg">
        <View className="items-center mb-3xl">
          <View className="w-[64px] h-[64px] rounded-full bg-primary-muted items-center justify-center mb-lg">
            <ThemedIcon name="people-outline" size={32} color={colors.primary} />
          </View>

          {previewLoading ? (
            <>
              <ActivityIndicator color={colors.primary} />
              <Text className="text-body text-text-secondary text-center mt-sm">
                {t('joinConfirm.loading')}
              </Text>
            </>
          ) : tokenInvalid ? (
            <>
              <Text className="text-heading-l text-text-primary text-center">
                {t('joinConfirm.title')}
              </Text>
              <Text className="text-body-small text-danger text-center mt-xs">
                {t('joinConfirm.expired')}
              </Text>
            </>
          ) : (
            <>
              <Text className="text-heading-l text-text-primary text-center">
                {tripPreview?.trip_title ?? t('joinConfirm.title')}
              </Text>

              {tripPreview && (
                <Text className="text-body text-primary text-center font-medium mt-xs">
                  {'📅 ' + formatDateRange(tripPreview.start_date, tripPreview.end_date)}
                </Text>
              )}

              <Text className="text-body text-text-secondary text-center mt-xs">
                {t('joinConfirm.subtitle')}
              </Text>
            </>
          )}
        </View>

        <View className="gap-md" style={{ alignSelf: 'center', width: 240 }}>
          {previewLoading ? null : tokenInvalid ? (
            <Button
              label={t('joinConfirm.cancel')}
              variant="secondary"
              onPress={handleCancel}
            />
          ) : (
            <>
              <Button
                label={loading ? t('joinConfirm.joining') : t('joinConfirm.join')}
                onPress={handleJoin}
                loading={loading}
                disabled={loading}
              />
              <Button
                label={t('joinConfirm.cancel')}
                variant="secondary"
                onPress={handleCancel}
                disabled={loading}
              />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
