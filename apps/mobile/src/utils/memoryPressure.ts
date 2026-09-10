import { AppState, Platform } from 'react-native';
import { Image } from 'expo-image';
import * as Sentry from '@sentry/react-native';

/**
 * Respond to the OS's own low-memory signal (iOS `memoryWarning`; effectively
 * never fires on web/Android). Cheap, non-destructive relief:
 *
 * - drop expo-image's in-memory bitmap cache (disk cache untouched — avatars
 *   still resolve offline),
 * - leave a breadcrumb — the one bit of memory-pressure signal retained now that
 *   `enableWatchdogTerminationTracking` is off; it only surfaces if some other
 *   error reports in the same session.
 *
 * Deliberately does NOT trim the TanStack Query cache: removing queries triggers
 * a re-persist that would erode the on-disk offline blob. Bounding cache growth
 * is `queryClient`'s `gcTime` job.
 */
export function installMemoryPressureHandler(): () => void {
  if (Platform.OS === 'web') return () => {};

  const sub = AppState.addEventListener('memoryWarning', () => {
    Sentry.addBreadcrumb({
      category: 'device',
      level: 'warning',
      message: 'ios_memory_warning',
    });
    try {
      Image.clearMemoryCache();
    } catch {
      // best-effort
    }
  });

  return () => sub.remove();
}
