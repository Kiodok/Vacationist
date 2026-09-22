import { Platform } from 'react-native';
import { storage } from '../../../utils/mmkvStorage';

// react-native-mmkv is native-only (JSI-based) — no web support, same reason
// useTutorialSeen.ts branches on Platform.OS. Falls back to localStorage on web.
//
// Remembered PER TRIP. The first expense of a trip must open in the trip's own currency, not in
// whatever was last picked on some other trip (device-test finding, v1.39.0 "Set1"); a later expense
// in the same trip then reuses what was picked here. The pre-1.39 global key is deliberately not read —
// migrating it would reproduce exactly that bug.
const keyFor = (tripId: string) => `last_used_expense_currency:${tripId}`;

export function getLastUsedCurrency(tripId: string): string | null {
  if (Platform.OS === 'web') return localStorage.getItem(keyFor(tripId));
  return storage.getString(keyFor(tripId)) ?? null;
}

export function setLastUsedCurrency(tripId: string, code: string): void {
  if (Platform.OS === 'web') localStorage.setItem(keyFor(tripId), code);
  else storage.set(keyFor(tripId), code);
}
