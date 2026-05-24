import { create } from 'zustand';
import { storage } from '../utils/mmkvStorage';

type ThemePreference = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const STORAGE_KEY = 'theme_preference';

function loadPersistedTheme(): ThemePreference {
  try {
    const stored = storage.getString(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  } catch {}
  return 'system';
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: loadPersistedTheme(),
  setTheme: (theme) => {
    storage.set(STORAGE_KEY, theme);
    set({ theme });
  },
}));
