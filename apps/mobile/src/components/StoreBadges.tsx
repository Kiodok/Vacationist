import { View, Text, Pressable, Platform, useWindowDimensions } from 'react-native';
import { useResolvedTheme } from '@vacationist/ui';
import { useTranslation } from 'react-i18next';
import { logAnalyticsEvent } from '@vacationist/api';
import type { AnalyticsEventName } from '@vacationist/types';
import { useAuthStore } from '../stores/authStore';
import { useConsentStore } from '../stores/consentStore';
import { PLAY_STORE_URL, APP_STORE_URL } from '../utils/storeUrl';

// "Get it on Play Store" / "Get it on App Store" text pills shown next to the avatar on the
// global Trips tab and next to the alerts bell inside a trip. web.vacationist.app only — a lot
// of users sign up on the web app and never install the native app; these give them a one-tap
// path.
//
// Renders null unless:
//   - Platform.OS === 'web'
//   - the user hasn't turned it off in Edit Profile (users.show_store_badges)
//
// Below 640px CSS width the labels shorten to "Play Store" / "App Store" so they fit the
// (already busy) trip header at phone-browser widths; useWindowDimensions re-renders live on
// browser resize.
//
// Both badges are always shown with equal weight — no user-agent detection / "primary CTA for
// your platform" logic (Phase 16 Tech Lead decision).

const COMPACT_BREAKPOINT = 640;

function openStore(
  url: string,
  eventName: Extract<AnalyticsEventName, 'play_store_click' | 'app_store_click'>,
) {
  // Best-effort funnel logging, consent-gated exactly like marketing/site/track.js. packages/api
  // throws by contract, so swallow at the call site — analytics must never block the click.
  if (useConsentStore.getState().decision === 'granted') {
    logAnalyticsEvent({
      event_name: eventName,
      surface: 'web_app',
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    }).catch(() => {});
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

interface BadgeProps {
  label: string;
  onPress: () => void;
}

function Badge({ label, onPress }: BadgeProps) {
  const isColorful = useResolvedTheme() === 'colorful';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={6}
      className="bg-surface border border-border rounded-full px-sm min-h-[32px] items-center justify-center"
      style={{
        borderWidth: isColorful ? 2 : 1,
        ...(isColorful && Platform.OS === 'web'
          ? ({ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } as object)
          : {}),
      }}
    >
      <Text className="text-body-small text-text-primary" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StoreBadges() {
  const { t } = useTranslation('common');
  const { width } = useWindowDimensions();
  const showStoreBadges = useAuthStore((s) => s.user?.show_store_badges);

  if (Platform.OS !== 'web') return null;
  if (showStoreBadges === false) return null;

  const compact = width < COMPACT_BREAKPOINT;

  return (
    <View className="flex-row items-center gap-xs">
      <Badge
        label={compact ? t('storeBadge.playShort') : t('storeBadge.play')}
        onPress={() => openStore(PLAY_STORE_URL, 'play_store_click')}
      />
      <Badge
        label={compact ? t('storeBadge.appStoreShort') : t('storeBadge.appStore')}
        onPress={() => openStore(APP_STORE_URL, 'app_store_click')}
      />
    </View>
  );
}
