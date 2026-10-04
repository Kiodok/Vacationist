import { Platform } from 'react-native';
import { storage } from '../../../utils/mmkvStorage';

// Separate from lastUsedCurrency.ts (expense), lastUsedTransferCurrency.ts (flights/rentals/
// public transport), and lastUsedAccommodationCurrency.ts — an activity's cost estimate is often
// in yet another currency habit (e.g. a local tour booked on-site), independent of whichever
// currency the user last picked for a flight, an accommodation, or an on-the-spot expense.
const KEY = 'last_used_activity_currency';

export function getLastUsedActivityCurrency(): string | null {
  if (Platform.OS === 'web') return localStorage.getItem(KEY);
  return storage.getString(KEY) ?? null;
}

export function setLastUsedActivityCurrency(code: string): void {
  if (Platform.OS === 'web') localStorage.setItem(KEY, code);
  else storage.set(KEY, code);
}
