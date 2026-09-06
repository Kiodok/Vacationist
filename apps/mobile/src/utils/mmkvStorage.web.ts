const PREFIX = 'mmkv:';

// The persisted query cache can grow past the ~5 MB localStorage quota on web
// (Phase 19). When a write throws QuotaExceededError, drop the query-cache blob
// (credentials + the mutation queue live under their own keys and are kept) and
// retry once, so persistence degrades to "this session only" instead of
// silently stopping forever.
const EVICTABLE_KEYS = ['REACT_QUERY_CACHE_v2'];

function trySet(fullKey: string, value: string): void {
  try {
    localStorage.setItem(fullKey, value);
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22);
    if (!isQuota) return;
    for (const k of EVICTABLE_KEYS) {
      try {
        localStorage.removeItem(PREFIX + k);
      } catch {
        // ignore
      }
    }
    try {
      localStorage.setItem(fullKey, value);
    } catch {
      // still no room — give up; the in-memory cache is unaffected
    }
  }
}

export const storage = {
  getString: (key: string): string | undefined => {
    try {
      const value = localStorage.getItem(PREFIX + key);
      return value ?? undefined;
    } catch {
      return undefined;
    }
  },
  set: (key: string, value: string): void => {
    trySet(PREFIX + key, value);
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {}
  },
};

export const mmkvStorageAdapter = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    trySet(PREFIX + key, value);
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {}
  },
};
