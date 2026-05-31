import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { resolveOnline, getInitialOnlineStatus } from '../hooks/netInfoUtils';

// null = status not yet determined (first render before async check completes)
// true = online; false = offline
const NetworkContext = createContext<boolean | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    // On Android, NetInfo.addEventListener fires immediately (before the
    // getInitialOnlineStatus promise resolves), so we track whether the
    // listener has already provided a value. If it has, we skip the promise
    // result to avoid overwriting a more-recent status with a stale one.
    let listenerFired = false;

    getInitialOnlineStatus().then((online) => {
      if (!listenerFired) {
        setIsConnected(online);
        onlineManager.setOnline(online);
      }
    }).catch(() => {});

    // Single shared subscription for both UI (OfflineBanner / Toast) and
    // TanStack Query's onlineManager.
    const unsubscribe = NetInfo.addEventListener((state) => {
      listenerFired = true;
      const online = resolveOnline(state);
      setIsConnected(online);
      onlineManager.setOnline(online);
    });

    return unsubscribe;
  }, []);

  return <NetworkContext.Provider value={isConnected}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus(): { isConnected: boolean | null } {
  return { isConnected: useContext(NetworkContext) };
}
