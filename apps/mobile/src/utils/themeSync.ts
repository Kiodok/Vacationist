import { systemColorScheme } from 'react-native-css-interop/dist/runtime/native/appearance-observables';

export function syncSystemColorScheme(value: 'light' | 'dark'): void {
  systemColorScheme.set(value);
}
