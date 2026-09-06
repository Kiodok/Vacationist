import { NativeModules, Platform } from 'react-native';

type GoogleSigninType = typeof import('@react-native-google-signin/google-signin').GoogleSignin;

let cached: GoogleSigninType | null | undefined;

/**
 * Lazily require + configure the Google Sign-In singleton. `configure()` sets
 * static state on the shared singleton, so calling this from every entry point
 * (login screen AND guest-upgrade sheet) is safe and idempotent — and necessary,
 * since the guest-upgrade sheet can be reached without the login screen ever
 * mounting.
 *
 * @returns the configured GoogleSignin, or null when the native module isn't
 *   linked (web, Expo Go).
 */
export function getConfiguredGoogleSignin(): GoogleSigninType | null {
  if (cached !== undefined) return cached;

  if (Platform.OS === 'web' || !NativeModules.RNGoogleSignin) {
    cached = null;
    return null;
  }

  const mod = require('@react-native-google-signin/google-signin');
  const GoogleSignin = mod.GoogleSignin as GoogleSigninType;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  cached = GoogleSignin;
  return cached;
}
