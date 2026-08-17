import { Platform } from 'react-native';

// Canonical per-platform store listing URL — App Store Connect id 6800049398,
// Android package com.vacationist.mobile. Shared by ForceUpdateGate and the
// review-nudge notification fallback so the two never drift.
export const STORE_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/us/app/vacationist/id6800049398'
    : 'https://play.google.com/store/apps/details?id=com.vacationist.mobile';
