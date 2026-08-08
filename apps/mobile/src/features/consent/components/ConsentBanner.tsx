import { View, Text, Pressable, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, useResolvedTheme } from '@vacationist/ui';
import { useConsentStore } from '../../../stores/consentStore';

// web.vacationist.app only. The marketing site (vacationist.app) has its own vanilla-JS
// banner (marketing/site/consent.js) — different origin, so consent does not carry over;
// this is a separate decision with the same copy and storage shape (see consentStore.ts).
const PRIVACY_URL = 'https://vacationist.app/privacy-policy.html';

export function ConsentBanner() {
  const { t } = useTranslation('consent');
  const decision = useConsentStore((s) => s.decision);
  const accept = useConsentStore((s) => s.accept);
  const decline = useConsentStore((s) => s.decline);
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';

  if (Platform.OS !== 'web' || decision !== null) return null;

  return (
    <View
      className="absolute left-0 right-0 bottom-0 bg-surface px-lg py-md"
      style={{
        zIndex: 50,
        borderTopWidth: isColorful ? 2 : 1,
        borderTopColor: colors.border,
        ...(Platform.OS === 'web' ? { boxShadow: '0 -4px 24px rgba(0,0,0,0.25)' } : {}),
      }}
    >
      <View className="max-w-2xl mx-auto w-full flex-row flex-wrap items-center gap-md">
        <View className="flex-1" style={{ minWidth: 240 }}>
          <Text className="text-body font-semibold text-text-primary mb-xs">{t('banner.title')}</Text>
          <Text className="text-body-small text-text-secondary">
            {t('banner.body')}{' '}
            <Text className="text-primary" onPress={() => Linking.openURL(PRIVACY_URL)}>
              {t('banner.privacy')}
            </Text>
          </Text>
        </View>
        <View className="flex-row gap-sm">
          <Pressable onPress={decline} className="px-lg py-sm rounded-sm bg-surface-elevated">
            <Text className="text-body-small font-semibold text-text-primary">{t('banner.decline')}</Text>
          </Pressable>
          <Pressable onPress={accept} className="px-lg py-sm rounded-sm bg-primary">
            <Text
              className="text-body-small font-semibold"
              style={{ color: isColorful ? colors.surface : '#ffffff' }}
            >
              {t('banner.accept')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
