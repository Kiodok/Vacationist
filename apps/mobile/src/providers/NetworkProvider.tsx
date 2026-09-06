import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { reconnectRealtime, refreshSessionQuietly } from '@vacationist/api';
import { resolveOnline, getInitialOnlineStatus } from '../hooks/netInfoUtils';
import { queryClient } from '../utils/queryClient';

// null = status not yet determined (first render before async check completes)
// true = online; false = offline
const NetworkContext = createContext<boolean | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  // Tracks the last known connectivity so we can fire reconnect work exactly on
  // an offline→online edge (not on every NetInfo event, which can be chatty).
  const wasOnlineRef = useRef<boolean | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleReconnect() {
      // Debounce against a flapping connection.
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        void refreshSessionQuietly();
        reconnectRealtime();
        // resumePausedMutations first so queued writes land before the refetch,
        // then bring every cached query up to date.
        void queryClient.resumePausedMutations().finally(() => {
          queryClient.invalidateQueries();
        });
      }, 1000);
    }

    function applyOnline(online: boolean) {
      const prev = wasOnlineRef.current;
      wasOnlineRef.current = online;
      setIsConnected(online);
      onlineManager.setOnline(online);
      if (online && prev === false) handleReconnect();
    }

    // On Android, NetInfo.addEventListener fires immediately (before the
    // getInitialOnlineStatus promise resolves), so we track whether the
    // listener has already provided a value. If it has, we skip the promise
    // result to avoid overwriting a more-recent status with a stale one.
    let listenerFired = false;

    getInitialOnlineStatus().then((online) => {
      if (!listenerFired) applyOnline(online);
    }).catch(() => {});

    // Single shared subscription for both UI (OfflineBanner / Toast) and
    // TanStack Query's onlineManager.
    const unsubscribe = NetInfo.addEventListener((state) => {
      listenerFired = true;
      applyOnline(resolveOnline(state));
    });

    return () => {
      unsubscribe();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <NetworkContext.Provider value={isConnected}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus(): { isConnected: boolean | null } {
  return { isConnected: useContext(NetworkContext) };
}
