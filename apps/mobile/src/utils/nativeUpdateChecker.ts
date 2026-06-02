import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import * as ExpoInAppUpdates from 'expo-in-app-updates';

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

let lastCheckedAt = 0;
let _lastResult: boolean | null = null;
let _checkInFlight: Promise<boolean | null> | null = null;

// True while the force-update modal is blocking the app.
// Read by updateChecker.ts to skip OTA reloads that would tear down the modal.
export let nativeUpdateGateActive = false;

export function setNativeUpdateGateActive(active: boolean) {
  nativeUpdateGateActive = active;
}

/**
 * Returns:
 *   true  — a Play Store update is available
 *   false — no update available (explicit clean result)
 *   null  — check skipped (cooldown / dev / non-Android) or failed (network /
 *           Play Core error); the caller must leave its current state unchanged
 */
export async function checkNativeUpdate(): Promise<boolean | null> {
  if (__DEV__) return false;
  if (Platform.OS !== 'android') return false;
  if (Updates.channel !== 'production') return false;

  // Deduplicate concurrent calls — e.g. the module-level early start and the
  // mount-effect call in ForceUpdateGate both resolve to the same promise.
  if (_checkInFlight) return _checkInFlight;

  const now = Date.now();
  // Bypass cooldown when the gate is active so the modal dismisses promptly
  // after the user installs the update and returns to the app.
  if (!nativeUpdateGateActive && now - lastCheckedAt < COOLDOWN_MS) {
    return _lastResult;
  }
  lastCheckedAt = now;

  _checkInFlight = (async (): Promise<boolean | null> => {
    try {
      const result = await ExpoInAppUpdates.checkForUpdate();
      _lastResult = result.updateAvailable;
      return _lastResult;
    } catch {
      // Don't overwrite _lastResult on error — leave prior cached value intact.
      return null;
    } finally {
      _checkInFlight = null;
    }
  })();

  return _checkInFlight;
}

// Kick off the check at module evaluation time, before any component renders,
// so the result (or in-flight promise) is ready when ForceUpdateGate mounts.
// This closes most of the window between SplashScreen.hideAsync() and modal
// appearance. All guards run inside checkNativeUpdate — this is a no-op in
// dev mode, on web, and on non-production channels.
checkNativeUpdate();
