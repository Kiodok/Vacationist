import { Platform } from 'react-native';

import type ExpoRestoreCredentialsModule from './src/ExpoRestoreCredentialsModule';

// Lazily resolved so iOS/web never hit requireNativeModule (the native side is Android-only).
let native: typeof ExpoRestoreCredentialsModule | null = null;
if (Platform.OS === 'android') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  native = require('./src/ExpoRestoreCredentialsModule').default;
}

/** True only on Android 9+ with Credential Manager available. iOS / web always false. */
export function isSupported(): boolean {
  if (Platform.OS !== 'android' || !native) return false;
  try {
    return native.isSupported();
  } catch {
    return false;
  }
}

/**
 * Creates a device-bound restore key from a WebAuthn PublicKeyCredentialCreationOptionsJSON
 * string. Resolves the registration-response JSON to send back to the server. Android only.
 */
export async function createRestoreKey(registrationJson: string): Promise<string> {
  if (!native) throw new Error('Restore credentials are not supported on this platform');
  return native.createRestoreKey(registrationJson);
}

/**
 * Attempts to retrieve the restore key on a new device from a WebAuthn
 * PublicKeyCredentialRequestOptionsJSON string. Resolves the assertion-response JSON, or null
 * when there is nothing to restore / the user dismissed the prompt. Android only.
 */
export async function getRestoreKey(authenticationJson: string): Promise<string | null> {
  if (!native) return null;
  return native.getRestoreKey(authenticationJson);
}

/** Deletes the restore key from the device and its cloud backup. Android only; no-op elsewhere. */
export async function clearRestoreKey(): Promise<void> {
  if (!native) return;
  await native.clearRestoreKey();
}
