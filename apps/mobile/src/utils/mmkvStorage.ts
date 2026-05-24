import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'vacationist-cache' });

export const mmkvStorageAdapter = {
  getItem: (key: string): string | null => {
    const value = storage.getString(key);
    return value ?? null;
  },
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  removeItem: (key: string): void => {
    storage.remove(key);
  },
};
