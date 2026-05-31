import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useUnreadCount } from '../../src/features/notifications/hooks/useUnreadCount';
import { useNotificationsRealtime } from '../../src/features/notifications/hooks/useNotifications';
import { colors, useThemeColors } from '@vacationist/ui';
import { ThemeVarsProvider } from '../../src/components/ThemeVarsProvider';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { OFFLINE_BANNER_HEIGHT } from '../../src/components/OfflineBanner';

export default function TabLayout() {
  const { t } = useTranslation('common');
  const { data: unreadCount = 0 } = useUnreadCount();
  useNotificationsRealtime();
  const tc = useThemeColors();
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();

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
          tabBarActiveTintColor: colors.primary,
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'airplane' : 'airplane-outline'}
              size={24}
              color={focused ? colors.primary : tc.textMuted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('tab.calendar'),
          tabBarActiveTintColor: colors.success,
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={24}
              color={focused ? colors.success : tc.textMuted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tab.notifications'),
          tabBarActiveTintColor: colors.warning,
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              size={24}
              color={focused ? colors.warning : tc.textMuted}
            />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab.profile'),
          tabBarActiveTintColor: colors.primaryLight,
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={focused ? colors.primaryLight : tc.textMuted}
            />
          ),
        }}
      />
    </Tabs>
  );
}
