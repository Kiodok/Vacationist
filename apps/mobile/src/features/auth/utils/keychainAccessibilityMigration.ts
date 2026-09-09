import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { AUTH_STORAGE_KEY, SECURE_STORE_OPTIONS } from '@vacationist/api';
import { storage } from '../../../utils/mmkvStorage';
import { clearAuthSnapshot, markVerified } from './authSnapshot';

/**
 * One-time re-key of the auth Keychain items to `AFTER_FIRST_UNLOCK` (iOS).
 *
 * Installed users already have the Supabase session written with
 * expo-secure-store's default `WHEN_UNLOCKED`. Changing `SECURE_STORE_OPTIONS`
 * alone does NOT fix them: `setItemAsync` on an existing key issues a bare
 * `SecItemUpdate` (only `kSecValueData`) — `kSecAttrAccessible` is only applied
 * on a fresh `SecItemAdd` (verified in expo-secure-store's SecureStoreModule.swift).
 * So the item must be deleted and re-added.
 *
 * Idempotent via an MMKV flag. Any failure leaves the flag unset so the next
 * launch retries. Call only when the app is foregrounded, unlocked and online
 * (i.e. right after a verified session load) so the delete+re-add can't run
 * against a locked Keychain.
 */

const DONE_FLAG = 'keychain_accessible_afu_v1';

export async function migrateKeychainAccessibility(userId: string): Promise<void> {
  if (Platform.OS !== 'ios') return; // Android Keystore has no equivalent gap
  if (storage.getBoolean(DONE_FLAG) === true) return;

  try {
    // 1. The Supabase session blob — read, delete, re-add with the new options.
    const raw = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
    if (raw) {
      await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
      try {
        await SecureStore.setItemAsync(AUTH_STORAGE_KEY, raw, SECURE_STORE_OPTIONS);
      } catch (reAddError) {
        // Re-add failed — restore the blob with the old defaults so the session
        // is never destroyed, and bail without setting the flag (retry later).
        await SecureStore.setItemAsync(AUTH_STORAGE_KEY, raw);
        throw reAddError;
      }
    }

    // 2. The offline-trust snapshot — no read needed, just rewrite it fresh
    //    (markVerified goes through SECURE_STORE_OPTIONS now).
    await clearAuthSnapshot();
    await markVerified(userId);

    // 3. The PKCE `…-code-verifier` key is deliberately skipped — transient,
    //    rewritten on every sign-in attempt.

    storage.set(DONE_FLAG, true);
  } catch {
    // Leave the flag unset; retried on the next verified load.
  }
}
