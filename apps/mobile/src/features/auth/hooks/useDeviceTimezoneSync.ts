import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { updateUserProfile } from '@vacationist/api';
import { useAuthStore } from '../../../stores/authStore';
import { saveUserToCache } from '../../../utils/userCache';
import { getDeviceTimezone } from '../../../utils/deviceTimezone';

/**
 * Keeps `users.timezone` equal to the phone's timezone, silently.
 *
 * The user never picks a timezone (v1.39.0): times are floating wall-clock digits, so a zone only
 * matters to the server-side activity-reminder cron, which needs to know when each member's local
 * morning is. Flying Germany → Porto changes the phone's zone; the next time the app is opened online
 * this notices and updates the profile, and reminders follow the traveller.
 *
 * Runs on sign-in and every return to the foreground. Skips when offline (retried next time) and when a
 * write for the same value already failed this session (no retry storm on a flaky profile row).
 */
export function useDeviceTimezoneSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const hasSession = useAuthStore((s) => s.hasSession);
  const failedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!hasSession || !userId) return;

    const sync = async () => {
      const user = useAuthStore.getState().user;
      if (!user || user.id !== userId) return;
      const tz = getDeviceTimezone();
      if (!tz || tz === user.timezone || failedFor.current === tz) return;
      if (!onlineManager.isOnline()) return;
      try {
        const updated = await updateUserProfile(user.id, { timezone: tz });
        useAuthStore.getState().setUser(updated);
        saveUserToCache(updated);
      } catch {
        failedFor.current = tz;
      }
    };

    void sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => sub.remove();
  }, [hasSession, userId]);
}
