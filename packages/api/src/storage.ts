import { Platform } from 'react-native';

const canUseLocalStorage =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined';

/**
 * SecureStore options for every auth-related Keychain item (iOS).
 *
 * `undefined` on web (the `localStorage` branch never touches expo-secure-store).
 * On native: `AFTER_FIRST_UNLOCK` — readable/writable once the device has been
 * unlocked at least once since boot. expo-secure-store's default is
 * `WHEN_UNLOCKED`, which throws `errSecInteractionNotAllowed` ("User interaction
 * is not allowed") the moment auth-js's background auto-refresh ticker touches
 * the Keychain while the phone is locked — the cause of Sentry REACT-NATIVE-M and
 * a latent repeat of the Phase 19 offline lockout. `AFTER_FIRST_UNLOCK` still
 * migrates to a new device via an encrypted backup, which `useAuthInit`'s
 * `minimalUser` path already assumes.
 */
export const SECURE_STORE_OPTIONS: { keychainAccessible: number } | undefined =
  Platform.OS === 'web'
    ? undefined
    : {
        keychainAccessible: (
          require('expo-secure-store') as typeof import('expo-secure-store')
        ).AFTER_FIRST_UNLOCK,
      };

/**
 * Last successfully-read/written value per key. A locked-device read throws; we
 * return this instead of `null` so a transient Keychain failure during a
 * background tick is not mistaken for "signed out".
 */
const lastKnownGood = new Map<string, string | null>();
/** Keys whose most recent `getItem` threw (as opposed to genuinely being absent). */
const readFailedKeys = new Set<string>();

/**
 * True when the most recent `getItem(key)` failed with a storage error rather
 * than returning "no value". Lets callers tell "no credentials on disk" from
 * "credentials exist but the Keychain was locked".
 */
export function lastSecureReadFailed(key: string): boolean {
  return readFailedKeys.has(key);
}

function createStorageAdapter() {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) =>
        canUseLocalStorage ? localStorage.getItem(key) : null,
      setItem: (key: string, value: string) => {
        if (canUseLocalStorage) localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        if (canUseLocalStorage) localStorage.removeItem(key);
      },
    };
  }

  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  return {
    async getItem(key: string): Promise<string | null> {
      try {
        const value = await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
        readFailedKeys.delete(key);
        lastKnownGood.set(key, value);
        return value;
      } catch {
        // errSecInteractionNotAllowed (device locked), Keystore fault, etc.
        // auth-js does NOT catch storage errors — swallow it here or it escapes
        // as an unhandled rejection. Serve the last value we saw, if any.
        readFailedKeys.add(key);
        return lastKnownGood.has(key) ? (lastKnownGood.get(key) as string | null) : null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
        readFailedKeys.delete(key);
        lastKnownGood.set(key, value);
      } catch {
        // Keep the in-memory copy so a same-session read still works.
        lastKnownGood.set(key, value);
      }
    },
    async removeItem(key: string): Promise<void> {
      // Clear the cache first — a real sign-out must never be able to serve a
      // stale blob back out of `lastKnownGood`.
      lastKnownGood.set(key, null);
      readFailedKeys.delete(key);
      try {
        await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
      } catch {
        // Best-effort; the null cache entry above already reflects the intent.
      }
    },
  };
}

export const ExpoSecureStoreAdapter = createStorageAdapter();
