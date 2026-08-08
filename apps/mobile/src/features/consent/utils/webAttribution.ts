import { Platform } from 'react-native';
import { storage } from '../../../utils/mmkvStorage';

// web.vacationist.app only. Mirrors marketing/site/track.js's captureAttribution(), separately
// — a different origin, so localStorage never carries the marketing site's capture across.
// See track.js's rewriteWebAppLinks() for how rdt_cid/utm_* get onto this origin's URL at all.
const KEY = 'web_attribution';

export interface WebAttribution {
  rdt_cid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

// Held in memory only until consent is granted — never written to durable storage before
// then, matching the "log nothing without consent" rule. If the visitor never consents, this
// simply falls out of scope when the tab closes; nothing is ever persisted.
let pending: WebAttribution | null = null;

// Captures the landing query string once, at module load (see _layout.tsx) — deliberately
// before any router redirect (e.g. AuthGate sending an unauthenticated visitor to /login) can
// strip it from the URL. A component-level useEffect would run too late for that same reason.
export function captureWebAttributionOnce(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || pending) return;
  try {
    const params = new URLSearchParams(window.location.search);
    const attr: WebAttribution = {};
    (['rdt_cid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const).forEach((k) => {
      const v = params.get(k);
      if (v) attr[k] = v;
    });
    if (attr.rdt_cid || attr.utm_source) pending = attr;
  } catch {
    // attribution capture must never break app startup
  }
}

// Promotes the in-memory capture to durable storage exactly once — call when consent becomes
// granted (see useConsentPixel, which already watches for exactly that transition).
export function commitPendingWebAttribution(): void {
  if (!pending || storage.getString(KEY)) return;
  storage.set(KEY, JSON.stringify(pending));
}

export function getWebAttribution(): WebAttribution | null {
  const raw = storage.getString(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WebAttribution;
  } catch {
    return null;
  }
}
