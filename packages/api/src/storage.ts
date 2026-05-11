import { Platform } from 'react-native';

const canUseLocalStorage =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined';

function createStorageAdapter() {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) =>
        canUseLocalStorage ? localStorage.getItem(key) : null,
      setItem: (key: string, value: string) => {
        if (canUseLocalStorage) localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        if (canUseLocalStorage) localStorage.removeItem(key);
      },
    };
  }

  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  return {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
}

export const ExpoSecureStoreAdapter = createStorageAdapter();
