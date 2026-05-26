import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { resolveOnline, fetchOnlineStatus } from './netInfoUtils';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Set initial state immediately rather than waiting for the first event
    fetchOnlineStatus().then(setIsConnected);

    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(resolveOnline(state));
    });
    return () => unsubscribe();
  }, []);

  return { isConnected };
}
