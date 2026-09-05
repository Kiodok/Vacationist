import { Platform } from 'react-native';
import { upsertWebPushSubscription } from '@vacationist/api';

/** Converts a URL-safe base64 VAPID public key into the Uint8Array pushManager.subscribe expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Loop-based, not spread (`[...new Uint8Array(buf)]`) — spread over a large ArrayBuffer can
 * overflow the call stack (String.fromCharCode.apply has the same ceiling; a plain loop doesn't). */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Registers this browser for Web Push (v1.34.0 item 1 — Phase 12). Push is non-critical — every
 * failure path (unsupported browser, permission denied, missing VAPID key) returns `false`
 * silently rather than throwing, so the app always works with or without it.
 */
export async function registerForWebPushAsync(): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // TS's lib.dom BufferSource typing is stricter about ArrayBufferLike vs ArrayBuffer than
      // the actual PushManager.subscribe() runtime contract (a plain Uint8Array has always
      // worked here) — cast rather than fight the type across TS/lib.dom version bumps.
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');
    if (!p256dhKey || !authKey) return false;

    await upsertWebPushSubscription({
      endpoint: subscription.endpoint,
      p256dhKey: arrayBufferToBase64(p256dhKey),
      authKey: arrayBufferToBase64(authKey),
      userAgent: navigator.userAgent,
    });

    return true;
  } catch {
    return false;
  }
}
