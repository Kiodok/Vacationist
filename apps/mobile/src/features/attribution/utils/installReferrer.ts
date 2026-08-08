import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { storage } from '../../../utils/mmkvStorage';

// Android only, Play Store installs only. The install referrer is how a Reddit ad click
// (captured as `rdt_cid` by marketing/site/track.js and baked into the Play Store link's
// `referrer` query param) survives from the ad click through the install into the app —
// see supabase/functions/attribution-capi for what happens with it after capture.
const REFERRER_KEY = 'attribution_referrer';
const REFERRER_READ_KEY = 'attribution_referrer_read';

export interface ParsedAttribution {
  rdt_cid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

function parseReferrer(referrer: string): ParsedAttribution {
  const params = new URLSearchParams(referrer);
  const out: ParsedAttribution = {};
  const rdt_cid = params.get('rdt_cid');
  const utm_source = params.get('utm_source');
  const utm_medium = params.get('utm_medium');
  const utm_campaign = params.get('utm_campaign');
  const utm_content = params.get('utm_content');
  if (rdt_cid) out.rdt_cid = rdt_cid;
  if (utm_source) out.utm_source = utm_source;
  if (utm_medium) out.utm_medium = utm_medium;
  if (utm_campaign) out.utm_campaign = utm_campaign;
  if (utm_content) out.utm_content = utm_content;
  return out;
}

// Reads the Play Install Referrer exactly once per install — the MMKV guard matters because
// the referrer is only meaningful on a fresh install (Play may return stale or empty data on
// later calls), and because the underlying Play service connection is not free to hold open.
// Must never throw and never block startup: called fire-and-forget from the root layout.
export async function captureInstallReferrerOnce(): Promise<void> {
  if (Platform.OS !== 'android' || storage.getString(REFERRER_READ_KEY)) return;

  try {
    const referrer = await Application.getInstallReferrerAsync();
    storage.set(REFERRER_READ_KEY, '1');
    if (!referrer) return;
    const attr = parseReferrer(referrer);
    if (attr.rdt_cid || attr.utm_source) {
      storage.set(REFERRER_KEY, JSON.stringify(attr));
    }
  } catch {
    // ERR_APPLICATION_INSTALL_REFERRER / ERR_APPLICATION_INSTALL_REFERRER_SERVICE_DISCONNECTED
    // etc. — no Play install referrer available (sideloaded APK, no Play Services, emulator
    // without Play Store, EAS preview build). Expected in dev; not worth surfacing.
    storage.set(REFERRER_READ_KEY, '1');
  }
}

export function getStoredAttribution(): ParsedAttribution | null {
  const raw = storage.getString(REFERRER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParsedAttribution;
  } catch {
    return null;
  }
}
