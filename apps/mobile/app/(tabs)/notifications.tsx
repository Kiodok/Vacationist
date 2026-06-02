import { View, Text, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Notification } from '@vacationist/types';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification, useDeleteAllNotifications } from '../../src/features/notifications/hooks/useNotifications';
import { NotificationItem } from '../../src/features/notifications/components/NotificationItem';
import { EmptyNotifications } from '../../src/features/notifications/components/EmptyNotifications';
import { NotificationListSkeleton } from '../../src/features/notifications/components/NotificationListSkeleton';
import { resolveNotificationPath } from '../../src/features/notifications/utils/resolveNotificationPath';
import { colors } from '@vacationist/ui';

export default function NotificationsScreen() {
  const { t } = useTranslation('notifications');
  const router = useRouter();
  const { data: notifications = [], isLoading, refetch, isRefetching } = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();
  const { mutate: deleteNotification } = useDeleteNotification();
  const { mutate: deleteAll, isPending: isDeletingAll } = useDeleteAllNotifications();

  const handlePress = (notification: Notification) => {
    if (!notification.is_read) {
      markRead({ notificationId: notification.id });
    }
    const path = resolveNotificationPath(notification);
    if (path) router.push(path as never);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row items-center justify-between px-lg py-md">
        <Text className="text-heading-l text-text-primary">{t('screen.title')}</Text>
        {notifications.some((n) => !n.is_read) ? (
          <Pressable onPress={() => markAllRead({})} disabled={isMarkingAll} hitSlop={8}>
            <Text className="text-body-small text-primary">
              {isMarkingAll ? t('marking') : t('markAllRead')}
            </Text>
          </Pressable>
        ) : notifications.length > 0 ? (
          <Pressable onPress={() => deleteAll({})} disabled={isDeletingAll} hitSlop={8}>
            <Text className="text-body-small text-danger">
              {isDeletingAll ? t('deleting') : t('deleteAll')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <NotificationListSkeleton />
      ) : (
        <FlashList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={handlePress}
              onDelete={(n) => deleteNotification({ notificationId: n.id })}
            />
          )}
          ListEmptyComponent={<EmptyNotifications />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
