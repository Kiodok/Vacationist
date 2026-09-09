import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { startAuthAutoRefresh, stopAuthAutoRefresh } from '@vacationist/api';

/**
 * Gate auth-js's token auto-refresh ticker on app foreground state (native only).
 *
 * `autoRefreshToken: true` (client.ts) starts a ~30s ticker that never stops on
 * its own. A tick on a backgrounded, locked iOS device hits the Keychain and
 * throws `errSecInteractionNotAllowed` — Sentry REACT-NATIVE-M. The React Native
 * contract is to run the ticker only while the app is `active`; `NetworkProvider`
 * still does an explicit `refreshSessionQuietly()` on regained connectivity.
 */
export function useSupabaseAutoRefresh() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (AppState.currentState === 'active') startAuthAutoRefresh();

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') startAuthAutoRefresh();
      else stopAuthAutoRefresh();
    });
    return () => {
      sub.remove();
      stopAuthAutoRefresh();
    };
  }, []);
}
