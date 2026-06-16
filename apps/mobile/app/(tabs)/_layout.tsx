import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useUnreadCount } from '../../src/features/notifications/hooks/useUnreadCount';
import { useNotificationsRealtime } from '../../src/features/notifications/hooks/useNotifications';
import { colors, useThemeColors, useResolvedTheme, ThemedIcon } from '@vacationist/ui';
import { ThemeVarsProvider } from '../../src/components/ThemeVarsProvider';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { OFFLINE_BANNER_HEIGHT } from '../../src/components/OfflineBanner';

export default function TabLayout() {
  const { t } = useTranslation('common');
  const { data: unreadCount = 0 } = useUnreadCount();
  useNotificationsRealtime();
  const tc = useThemeColors();
  const theme = useResolvedTheme();
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  // In colorful mode the tab icons/labels use the warm wine tone instead of purple
  const tabActivePrimary = theme === 'colorful' ? tc.textPrimary : tc.primary;
  const tabActivePrimaryLight = theme === 'colorful' ? tc.textSecondary : tc.primaryLight;

  return (
    <Tabs
      screenLayout={({ children }) => <ThemeVarsProvider>{children}</ThemeVarsProvider>}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: tc.background },
        tabBarStyle: {
          backgroundColor: tc.background,
          borderTopColor: tc.border,
          bottom: isConnected === false ? OFFLINE_BANNER_HEIGHT + insets.bottom : 0,
          paddingBottom: isConnected === false ? 0 : undefined,
        },
        tabBarInactiveTintColor: tc.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.trips'),
          tabBarActiveTintColor: tabActivePrimary,
          tabBarIcon: ({ focused }) => (
            <ThemedIcon
              name={focused ? 'airplane' : 'airplane-outline'}
              size={24}
              color={focused ? tabActivePrimary : tc.textMuted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('tab.calendar'),
          tabBarActiveTintColor: tc.success,
          tabBarIcon: ({ focused }) => (
            <ThemedIcon
              name={focused ? 'calendar' : 'calendar-outline'}
              size={24}
              color={focused ? tc.success : tc.textMuted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tab.notifications'),
          tabBarActiveTintColor: tc.warning,
          tabBarIcon: ({ focused }) => (
            <ThemedIcon
              name={focused ? 'notifications' : 'notifications-outline'}
              size={24}
              color={focused ? tc.warning : tc.textMuted}
            />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: tc.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab.profile'),
          tabBarActiveTintColor: tabActivePrimaryLight,
          tabBarIcon: ({ focused }) => (
            <ThemedIcon
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={focused ? tabActivePrimaryLight : tc.textMuted}
            />
          ),
        }}
      />
    </Tabs>
  );
}
