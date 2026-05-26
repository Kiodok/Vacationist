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
