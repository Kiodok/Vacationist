import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { resolveNotificationPath } from '../utils/resolveNotificationPath';

export function usePushNotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const type = data?.type as string | undefined;
      const tripId = (data?.tripId as string | undefined) ?? null;
      const relatedType = (data?.relatedType as string | undefined) ?? null;

      if (!type) return;

      const path = resolveNotificationPath({
        type: type as never,
        trip_id: tripId as string,
        related_type: relatedType,
      });
      if (path) {
        router.push(path as never);
      }
    });

    return () => subscription.remove();
  }, [router]);
}
