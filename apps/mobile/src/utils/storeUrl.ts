import { Platform } from 'react-native';

// Canonical store listing URLs — App Store Connect id 6800049398, Android package
// com.vacationist.mobile. Kept identical to marketing/site/build.mjs (PLAY_URL / APP_STORE_URL)
// so every "get the app" surface across the repo points at the same place.
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.vacationist.mobile';
export const APP_STORE_URL = 'https://apps.apple.com/us/app/vacationist/id6800049398';

// The single per-platform URL used by native-only consumers (ForceUpdateGate, the review-nudge
// fallback) — resolves to the store the current build was installed from. On web this yields the
// Play URL; web surfaces that need both stores use the named constants above instead.
export const STORE_URL = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
