import { View, Text, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Notification } from '@vacationist/types';
import { useTripNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification, useDeleteAllNotifications } from '../../../src/features/notifications/hooks/useNotifications';
import { NotificationItem } from '../../../src/features/notifications/components/NotificationItem';
import { EmptyNotifications } from '../../../src/features/notifications/components/EmptyNotifications';
import { resolveNotificationPath } from '../../../src/features/notifications/utils/resolveNotificationPath';
import { colors } from '@vacationist/ui';

export default function TripNotificationsScreen() {
  const { t } = useTranslation('notifications');
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: notifications = [], isLoading, refetch, isRefetching } = useTripNotifications(tripId!);
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
      <View className="flex-row items-center justify-between px-lg py-md border-b border-border">
        <View className="flex-row items-center gap-md">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#F2F2F2" />
          </Pressable>
          <Text className="text-heading-s text-text-primary">{t('screen.title')}</Text>
        </View>
        {notifications.some((n) => !n.is_read) ? (
          <Pressable onPress={() => markAllRead({ tripId })} disabled={isMarkingAll} hitSlop={8}>
            <Text className="text-body-small text-primary">
              {isMarkingAll ? t('marking') : t('markAllRead')}
            </Text>
          </Pressable>
        ) : notifications.length > 0 ? (
          <Pressable onPress={() => deleteAll({ tripId })} disabled={isDeletingAll} hitSlop={8}>
            <Text className="text-body-small text-danger">
              {isDeletingAll ? t('deleting') : t('deleteAll')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlashList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={handlePress}
              onDelete={(n) => deleteNotification({ notificationId: n.id, tripId })}
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
