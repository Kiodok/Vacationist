import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { Notification } from '@vacationist/types';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../src/features/notifications/hooks/useNotifications';
import { NotificationItem } from '../../src/features/notifications/components/NotificationItem';
import { EmptyNotifications } from '../../src/features/notifications/components/EmptyNotifications';
import { resolveNotificationPath } from '../../src/features/notifications/utils/resolveNotificationPath';

export default function NotificationsScreen() {
  const router = useRouter();
  const { data: notifications = [], isLoading, refetch, isRefetching } = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();

  const handlePress = (notification: Notification) => {
    if (!notification.is_read) {
      markRead(notification.id);
    }
    const path = resolveNotificationPath(notification);
    if (path) router.push(path as never);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center justify-between px-lg py-md">
        <Text className="text-heading-l text-text-primary">Notifications</Text>
        {notifications.some((n) => !n.is_read) && (
          <Pressable onPress={() => markAllRead()} disabled={isMarkingAll} hitSlop={8}>
            <Text className="text-body-small text-primary">
              {isMarkingAll ? 'Marking...' : 'Mark all read'}
            </Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
          renderItem={({ item }) => (
            <NotificationItem notification={item} onPress={handlePress} />
          )}
          ListEmptyComponent={<EmptyNotifications />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#6C63FF"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
