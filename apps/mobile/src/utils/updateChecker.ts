import * as Updates from 'expo-updates';
import { nativeUpdateGateActive } from './nativeUpdateChecker';

let lastCheckedAt = 0;
const CHECK_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export async function checkForUpdate(): Promise<void> {
  if (__DEV__) return;
  if (!Updates.isEnabled) return;

  // Skip OTA reloads while the native update gate is active. Calling
  // Updates.reloadAsync() while the force-update modal is visible would tear
  // down the modal and leave the user in a confusing half-updated state.
  if (nativeUpdateGateActive) return;

  // Dev client builds can run standalone with __DEV__ = false — guard by channel
  // so only preview/production builds ever pull OTA updates.
  const channel = Updates.channel;
  if (channel !== 'preview' && channel !== 'production') return;

  const now = Date.now();
  if (now - lastCheckedAt < CHECK_COOLDOWN_MS) return;
  lastCheckedAt = now;

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // Silently ignore — the app continues on the current bundle
  }
}
