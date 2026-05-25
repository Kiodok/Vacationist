import { create } from 'zustand';
import { Appearance, Platform } from 'react-native';
import { storage } from '../utils/mmkvStorage';
// NativeWind reads colorScheme from systemColorScheme (native) or colorSchemeObservable
// (web). Both must be updated before Zustand triggers React re-renders, so that
// ThemeRemountKey's forced remount runs initReducer with the already-correct value.
import { colorScheme as cssColorScheme } from 'react-native-css-interop';
import { systemColorScheme } from 'react-native-css-interop/dist/runtime/native/appearance-observables';

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
    const effective: 'light' | 'dark' =
      theme === 'system'
        ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light')
        : theme;

    // Update NativeWind's observable synchronously BEFORE Zustand notifies React.
    // This guarantees that when ThemeRemountKey changes its key and React unmounts +
    // remounts screen content, initReducer reads the new colorScheme on first render
    // instead of relying on the unreliable useReducer dispatch on Android Fabric.
    systemColorScheme.set(effective);

    // Web: toggle the .dark CSS class on <html>. Guard avoids the SSR throw
    // ("Cannot manually set color scheme while not in a browser environment").
    if (Platform.OS !== 'web' || typeof window !== 'undefined') {
      cssColorScheme.set(effective);
    }

    storage.set(STORAGE_KEY, theme);
    set({ theme });
  },
}));
