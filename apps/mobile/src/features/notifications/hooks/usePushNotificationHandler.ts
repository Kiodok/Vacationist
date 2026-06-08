import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { resolveNotificationPath } from '../utils/resolveNotificationPath';

export function usePushNotificationHandler() {
  const router = useRouter();
  // Tracks the last-handled notification identifier to prevent double-navigation
  // when both the listener and useLastNotificationResponse fire for the same tap.
  const handledRef = useRef<string | null>(null);

  const handleResponse = useCallback((response: Notifications.NotificationResponse) => {
    const notifId = response.notification.request.identifier;
    if (handledRef.current === notifId) return;
    handledRef.current = notifId;

    const data = response.notification.request.content.data as Record<string, unknown>;
    const type = data?.type as string | undefined;
    const tripId = (data?.tripId as string | undefined) ?? null;
    const relatedType = (data?.relatedType as string | undefined) ?? null;
    const relatedId = (data?.relatedId as string | undefined) ?? null;

    if (!type) return;

    const path = resolveNotificationPath({
      type: type as never,
      trip_id: tripId as string,
      related_type: relatedType,
      related_id: relatedId,
    });
    if (path) {
      router.push(path as never);
    }
  }, [router]);

  // Handle taps when the app is in foreground or background.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [handleResponse]);

  // Handle taps from a cold start (app was not running).
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!lastResponse) return;
    handleResponse(lastResponse);
    // Only run once per lastResponse reference (it changes when a new tap arrives).
  }, [lastResponse, handleResponse]);
}
