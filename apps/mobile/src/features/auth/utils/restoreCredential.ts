import { Platform } from 'react-native';
import {
  getRestoreRegistrationOptions,
  verifyRestoreRegistration,
  getRestoreAuthenticationOptions,
  verifyRestoreAuthentication,
  deleteRestoreCredential,
  signInWithRestoreTokenHash,
} from '@vacationist/api';
import { isAuthenticated, type User } from '@vacationist/types';
import {
  isSupported as nativeIsSupported,
  createRestoreKey,
  getRestoreKey,
  clearRestoreKey as nativeClearRestoreKey,
} from '../../../../modules/expo-restore-credentials';
import { storage } from '../../../utils/mmkvStorage';

// Phase 17 — Android Zero-Tap Sign-In (Google Play technical-quality requirement, April 2027).
// Every function here is best-effort: a failure must never block sign-in, sign-out or app start.
// Android only — no-ops (and reports unsupported) on iOS / web.

const REGISTERED_FLAG = 'restore_credential_registered_v1';

export function restoreCredentialSupported(): boolean {
  return Platform.OS === 'android' && nativeIsSupported();
}

/**
 * After a successful sign-in of a full (email-bearing, non-guest) account, make sure a device
 * restore key exists. Idempotent via an MMKV flag; cleared on sign-out so the next sign-in
 * re-registers. Guests are skipped — generateLink needs an email to restore them later.
 */
export async function ensureRestoreKey(user: User): Promise<void> {
  try {
    if (!restoreCredentialSupported()) return;
    if (!isAuthenticated(user)) return;
    if (storage.getBoolean(REGISTERED_FLAG) === true) return;

    const registrationJson = await getRestoreRegistrationOptions();
    const registrationResponseJson = await createRestoreKey(registrationJson);
    await verifyRestoreRegistration(registrationResponseJson);
    storage.set(REGISTERED_FLAG, true);
  } catch {
    // Non-critical — the app works fine without a restore key; just try again next sign-in.
  }
}

// Hard cap on the cold-start restore attempt — it sits on the splash-screen critical path, so
// a slow network must never leave the user staring at the splash. On timeout we just fall
// through to the login screen.
const RESTORE_TIMEOUT_MS = 8000;

async function doRestoreSignIn(): Promise<boolean> {
  if (!restoreCredentialSupported()) return false;

  const authenticationJson = await getRestoreAuthenticationOptions();
  const assertionResponseJson = await getRestoreKey(authenticationJson);
  if (!assertionResponseJson) return false; // nothing to restore / user dismissed

  const { tokenHash } = await verifyRestoreAuthentication(assertionResponseJson);
  await signInWithRestoreTokenHash(tokenHash);
  storage.set(REGISTERED_FLAG, true); // this device now has a working key
  return true;
}

/**
 * On a cold start with no local session, try to silently restore the previous device's
 * sign-in. Returns true if a session was established (onAuthStateChange then takes over).
 * Resolves fast (false) when there is no credential to restore, on any error, or on timeout.
 */
export async function attemptRestoreSignIn(): Promise<boolean> {
  try {
    return await Promise.race([
      doRestoreSignIn(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), RESTORE_TIMEOUT_MS)),
    ]);
  } catch {
    return false;
  }
}

/**
 * On sign-out: delete the server row (needs the still-valid session, so call this BEFORE
 * signOut()), drop the device key, and clear the flag so the next sign-in re-registers.
 * Every step is best-effort and independent.
 */
export async function clearRestoreKey(): Promise<void> {
  storage.remove(REGISTERED_FLAG);
  await Promise.allSettled([
    deleteRestoreCredential(),
    restoreCredentialSupported() ? nativeClearRestoreKey() : Promise.resolve(),
  ]);
}
