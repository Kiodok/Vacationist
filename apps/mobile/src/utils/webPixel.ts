import { Platform } from 'react-native';

// web.vacationist.app only — the only web surface where a real sign-up can be observed
// client-side. Mirrors marketing/site/consent.js's loadRdt(), translated to TS. Must only be
// called after the visitor has accepted via useConsentStore (see useConsentPixel below) —
// never eagerly.
const REDDIT_PIXEL_ID = 'a2_jcz7aqtl8eua';

type RdtFn = ((...args: unknown[]) => void) & {
  callQueue: unknown[][];
  sendEvent?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    rdt?: RdtFn;
  }
}

let pixelLoaded = false;

export function loadRedditPixel(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || pixelLoaded) return;
  pixelLoaded = true;

  if (!window.rdt) {
    const rdt = ((...args: unknown[]) => {
      if (rdt.sendEvent) rdt.sendEvent(...args);
      else rdt.callQueue.push(args);
    }) as RdtFn;
    rdt.callQueue = [];
    window.rdt = rdt;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.redditstatic.com/ads/pixel.js';
    document.head.appendChild(script);
  }

  window.rdt('init', REDDIT_PIXEL_ID);
  window.rdt('track', 'PageVisit');
}

// Fires a standard/custom Reddit event. No-ops on native or before the pixel has loaded (i.e.
// before consent) — callers don't need to guard this themselves.
//
// conversionId: pass the SAME value used in the matching attribution-capi call for this event
// (see trackSignUp.ts) — Reddit deduplicates a pixel event and a server (CAPI) event when they
// share a conversionId/conversion_id and event name. Omit for events that only ever go through
// the pixel (e.g. Lead), where there is no CAPI counterpart to deduplicate against.
export function trackRedditEvent(eventName: string, conversionId?: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.rdt) return;
  window.rdt('track', eventName, conversionId ? { conversionId } : undefined);
}
