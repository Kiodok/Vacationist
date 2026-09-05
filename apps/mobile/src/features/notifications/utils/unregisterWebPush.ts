import { Platform } from 'react-native';
import { deleteWebPushSubscription } from '@vacationist/api';

function isWebPushSupported(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

export async function getWebPushEndpoint(): Promise<string | null> {
  if (!isWebPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription?.endpoint ?? null;
  } catch {
    return null;
  }
}

/** Called on sign-out (useSignOut.ts), alongside the existing native deletePushToken(pushToken)
 * call — both run before the session is destroyed. Guards its own platform support, so callers
 * don't need an extra Platform.OS check. */
export async function unregisterWebPushAsync(): Promise<void> {
  if (!isWebPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await deleteWebPushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
  } catch {
    // Best-effort cleanup — sign-out must never fail because push unregistration did.
  }
}
