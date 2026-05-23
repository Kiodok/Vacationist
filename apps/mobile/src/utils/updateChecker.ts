import * as Updates from 'expo-updates';

export async function checkForUpdate(): Promise<void> {
  // No-op in development — OTA only applies to production/preview builds
  if (__DEV__) return;

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Reload to apply the new bundle
      await Updates.reloadAsync();
    }
  } catch {
    // Silently ignore — the app continues on the current bundle
  }
}
