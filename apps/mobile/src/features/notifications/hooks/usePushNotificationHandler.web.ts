// Web push tap handling lives in the service worker (apps/mobile/public/sw.js
// 'notificationclick' handler), not in React — so this hook is a no-op on web,
// where the native expo-notifications listener APIs it would call don't exist.
export function usePushNotificationHandler() {}
