import NetInfo from '@react-native-community/netinfo';

// isInternetReachable can be null while Android checks the connection —
// treat null as "potentially online" to avoid false offline banners/blocks.
export function resolveOnline(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/** Returns a one-shot snapshot of the current network state. */
export async function fetchOnlineStatus(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return resolveOnline(state);
}

// Cached so both QueryProvider.onSuccess and NetworkProvider share a single
// NetInfo.fetch() call at startup instead of issuing two back-to-back requests.
let _initialStatusPromise: Promise<boolean> | null = null;

export function getInitialOnlineStatus(): Promise<boolean> {
  if (!_initialStatusPromise) {
    _initialStatusPromise = fetchOnlineStatus().catch((err) => {
      // Allow a retry on the next call if the native bridge wasn't ready yet.
      _initialStatusPromise = null;
      throw err;
    });
  }
  return _initialStatusPromise;
}
