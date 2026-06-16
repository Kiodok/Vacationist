import { create } from 'zustand';
import { Appearance, Platform } from 'react-native';
import { storage } from '../utils/mmkvStorage';
import { colorScheme as cssColorScheme } from 'react-native-css-interop';
import { syncSystemColorScheme } from '../utils/themeSync';

export type ThemePreference = 'dark' | 'light' | 'system' | 'colorful';

interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const STORAGE_KEY = 'theme_preference';

function loadPersistedTheme(): ThemePreference {
  try {
    const stored = storage.getString(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system' || stored === 'colorful') return stored;
  } catch {}
  return Platform.OS === 'web' ? 'dark' : 'colorful';
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: loadPersistedTheme(),
  setTheme: (theme) => {
    const effective: 'light' | 'dark' =
      theme === 'system'
        ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light')
        : theme === 'colorful'
          ? 'light'
          : theme;

    // Update NativeWind's observable synchronously BEFORE Zustand notifies React.
    // This guarantees that when ThemeRemountKey changes its key and React unmounts +
    // remounts screen content, initReducer reads the new colorScheme on first render
    // instead of relying on the unreliable useReducer dispatch on Android Fabric.
    syncSystemColorScheme(effective);

    // Web: toggle the .dark CSS class on <html>. Guard avoids the SSR throw
    // ("Cannot manually set color scheme while not in a browser environment").
    if (Platform.OS !== 'web' || typeof window !== 'undefined') {
      cssColorScheme.set(effective);
    }

    storage.set(STORAGE_KEY, theme);
    set({ theme });
  },
}));
