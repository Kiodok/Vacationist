const PREFIX = 'mmkv:';

export const storage = {
  getString: (key: string): string | undefined => {
    try {
      const value = localStorage.getItem(PREFIX + key);
      return value ?? undefined;
    } catch {
      return undefined;
    }
  },
  set: (key: string, value: string): void => {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {}
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {}
  },
};

export const mmkvStorageAdapter = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {}
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {}
  },
};
