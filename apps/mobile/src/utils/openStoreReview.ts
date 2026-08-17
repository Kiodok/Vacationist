import { Linking } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { STORE_URL } from './storeUrl';

// Used by the review_nudge notification tap handlers (in-app list + push tap).
// Prefers the native in-app review sheet (SKStoreReviewController on iOS, Play
// In-App Review on Android); falls back to opening the platform store page
// when the native prompt is unavailable (rate-limited, unsupported OS version,
// or the promise rejects).
export async function openStoreReviewOrFallback(): Promise<void> {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (available) {
      await StoreReview.requestReview();
      return;
    }
  } catch {
    // fall through to the store URL below
  }
  Linking.openURL(STORE_URL);
}
