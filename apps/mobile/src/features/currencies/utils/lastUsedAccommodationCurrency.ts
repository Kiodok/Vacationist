import { Platform } from 'react-native';
import { storage } from '../../../utils/mmkvStorage';

// Separate from lastUsedCurrency.ts (expense) and lastUsedTransferCurrency.ts (flights/rentals/
// public transport) — item 12 extension: a user's accommodation bookings are often paid in the
// destination's local currency, independent of whichever currency they last used for a flight or
// an on-the-spot expense, so remembering it separately avoids one habit overriding another.
const KEY = 'last_used_accommodation_currency';

export function getLastUsedAccommodationCurrency(): string | null {
  if (Platform.OS === 'web') return localStorage.getItem(KEY);
  return storage.getString(KEY) ?? null;
}

export function setLastUsedAccommodationCurrency(code: string): void {
  if (Platform.OS === 'web') localStorage.setItem(KEY, code);
  else storage.set(KEY, code);
}
