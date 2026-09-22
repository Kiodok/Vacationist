import { getCalendars } from 'expo-localization';

/**
 * The phone's IANA timezone (e.g. "Europe/Berlin"). Never shown to the user and never chosen by them:
 * times in the app are floating wall-clock digits, so a zone only matters server-side, where the
 * activity-reminder cron uses each member's zone to decide WHEN their local morning is.
 *
 * `expo-localization` reads it natively (reliable on Hermes, unlike `Intl.DateTimeFormat().resolvedOptions()`
 * on older Android ICU); the Intl fallback covers web and any platform where the native call throws.
 */
export function getDeviceTimezone(): string {
  try {
    const tz = getCalendars()[0]?.timeZone;
    if (tz) return tz;
  } catch {
    // fall through to Intl
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
