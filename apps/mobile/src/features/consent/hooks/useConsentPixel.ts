import { useEffect } from 'react';
import { useConsentStore } from '../../../stores/consentStore';
import { loadRedditPixel } from '../../../utils/webPixel';
import { commitPendingWebAttribution } from '../utils/webAttribution';

// Mounted once, unconditionally, in the root layout — fires whenever consent is (or becomes)
// 'granted': covers both a fresh Accept during this session and a returning visitor whose
// decision was already persisted. No-ops on native (both callees are Platform.OS-guarded).
export function useConsentPixel(): void {
  const decision = useConsentStore((s) => s.decision);

  useEffect(() => {
    if (decision !== 'granted') return;
    loadRedditPixel();
    commitPendingWebAttribution();
  }, [decision]);
}
