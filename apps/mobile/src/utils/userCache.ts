import { storage } from './mmkvStorage';
import type { User } from '@vacationist/types';

const KEY = 'cached_user_profile';

export function saveUserToCache(user: User): void {
  try {
    storage.set(KEY, JSON.stringify(user));
  } catch {}
}

export function loadUserFromCache(): User | null {
  try {
    const raw = storage.getString(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function clearUserCache(): void {
  try {
    storage.remove(KEY);
  } catch {}
}
