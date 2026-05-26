import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { resolveOnline, fetchOnlineStatus } from './netInfoUtils';

export function useOnlineManager() {
  useEffect(() => {
    // Prime the online manager before the first event fires
    fetchOnlineStatus().then((online) => onlineManager.setOnline(online));

    const unsubscribe = NetInfo.addEventListener((state) => {
      onlineManager.setOnline(resolveOnline(state));
    });
    return () => unsubscribe();
  }, []);
}
