import { Platform } from 'react-native';
import { storage } from '../../../utils/mmkvStorage';

// Separate from lastUsedCurrency.ts (expense currency) — item 12: a user's transfer entries
// (flights/rentals/public transport, often booked in advance in a home currency) and their
// expense entries (often logged on the spot in the local currency) are frequently in different
// currencies, so remembering them independently avoids one habit silently overriding the other.
const KEY = 'last_used_transfer_currency';

export function getLastUsedTransferCurrency(): string | null {
  if (Platform.OS === 'web') return localStorage.getItem(KEY);
  return storage.getString(KEY) ?? null;
}

export function setLastUsedTransferCurrency(code: string): void {
  if (Platform.OS === 'web') localStorage.setItem(KEY, code);
  else storage.set(KEY, code);
}
