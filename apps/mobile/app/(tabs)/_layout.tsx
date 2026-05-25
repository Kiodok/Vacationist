import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUnreadCount } from '../../src/features/notifications/hooks/useUnreadCount';
import { useNotificationsRealtime } from '../../src/features/notifications/hooks/useNotifications';
import { colors, useThemeColors } from '@vacationist/ui';
import { ThemeVarsProvider } from '../../src/components/ThemeVarsProvider';

export default function TabLayout() {
  const { data: unreadCount = 0 } = useUnreadCount();
  useNotificationsRealtime();
  const tc = useThemeColors();

  return (
    <Tabs
      screenLayout={({ children }) => <ThemeVarsProvider>{children}</ThemeVarsProvider>}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: tc.background },
        tabBarStyle: {
          backgroundColor: tc.background,
          borderTopColor: tc.border,
        },
        tabBarInactiveTintColor: tc.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trips',
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
          title: 'Calendar',
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
          title: 'Alerts',
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
          title: 'Profile',
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
