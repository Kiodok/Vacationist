import { create } from 'zustand';
import { storage } from '../utils/mmkvStorage';

// web.vacationist.app only — the native app has no cookies/pixels to gate. Mirrors
// marketing/site/consent.js's storage shape (schema-versioned decision + timestamp) so both
// surfaces behave identically, but is a separate decision from the marketing site: they are
// different origins and localStorage does not cross that boundary.
export type ConsentDecision = 'granted' | 'denied' | null;

interface ConsentState {
  decision: ConsentDecision;
  accept: () => void;
  decline: () => void;
}

const STORAGE_KEY = 'web_consent'; // -> localStorage 'mmkv:web_consent' via mmkvStorage.web.ts
const SCHEMA = 1;

function loadPersistedConsent(): ConsentDecision {
  try {
    const raw = storage.getString(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === SCHEMA && (parsed.decision === 'granted' || parsed.decision === 'denied')) {
      return parsed.decision;
    }
  } catch {
    // malformed entry — treat as undecided, banner will re-prompt
  }
  return null;
}

function persist(decision: 'granted' | 'denied'): void {
  try {
    storage.set(STORAGE_KEY, JSON.stringify({ v: SCHEMA, decision, ts: new Date().toISOString() }));
  } catch {
    // storage unavailable (private mode etc.) — decision still applies for this session
  }
}

export const useConsentStore = create<ConsentState>()((set) => ({
  decision: loadPersistedConsent(),
  accept: () => {
    persist('granted');
    set({ decision: 'granted' });
  },
  decline: () => {
    persist('denied');
    set({ decision: 'denied' });
  },
}));
