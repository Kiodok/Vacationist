import * as Updates from 'expo-updates';

let lastCheckedAt = 0;
const CHECK_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export async function checkForUpdate(): Promise<void> {
  if (__DEV__) return;

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
