import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { storage } from '../../../utils/mmkvStorage';

const KEY = 'tutorial_seen_v3';

function readSeen(): boolean {
  if (Platform.OS === 'web') return localStorage.getItem(KEY) === 'true';
  return storage.getBoolean(KEY) === true;
}

function writeSeen(): void {
  if (Platform.OS === 'web') localStorage.setItem(KEY, 'true');
  else storage.set(KEY, true);
}

export function useTutorialSeen(): { seen: boolean; markSeen: () => void } {
  const [seen, setSeen] = useState(readSeen);

  const markSeen = useCallback(() => {
    writeSeen();
    setSeen(true);
  }, []);

  return { seen, markSeen };
}
