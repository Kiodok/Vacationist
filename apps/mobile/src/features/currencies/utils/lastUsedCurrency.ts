import { Platform } from 'react-native';
import { storage } from '../../../utils/mmkvStorage';

// react-native-mmkv is native-only (JSI-based) — no web support, same reason
// useTutorialSeen.ts branches on Platform.OS. Falls back to localStorage on web.
const KEY = 'last_used_expense_currency';

export function getLastUsedCurrency(): string | null {
  if (Platform.OS === 'web') return localStorage.getItem(KEY);
  return storage.getString(KEY) ?? null;
}

export function setLastUsedCurrency(code: string): void {
  if (Platform.OS === 'web') localStorage.setItem(KEY, code);
  else storage.set(KEY, code);
}
