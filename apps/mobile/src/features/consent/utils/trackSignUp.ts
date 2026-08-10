import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { reportSignUpAttribution, claimSignupAttribution } from '@vacationist/api';
import type { User } from '@vacationist/types';
import { trackRedditEvent } from '../../../utils/webPixel';
import { useConsentStore } from '../../../stores/consentStore';
import { getStoredAttribution } from '../../attribution/utils/installReferrer';
import { getWebAttribution } from '../utils/webAttribution';

// In-memory fast path, keyed by user id — avoids a redundant claimSignupAttribution round
// trip when ensureUserProfile resolves multiple times for the same sign-in within one running
// app session (on web's OAuth-redirect path, useAuthInit's loadSession() and its
// onAuthStateChange listener can both resolve for the same fresh sign-in). This is NOT the
// source of truth for "already reported" — that lives in the DB (signup_attribution_claimed_at,
// see claimSignupAttribution) and survives app restarts and account deletion/resignup cycles.
// Deliberately keyed by id, not a bare boolean, so a later, different account signing in during
// the same app session still tracks correctly.
let trackedUserId: string | null = null;

// Fires the SignUp conversion for a genuine new full-account creation, or for a guest
// upgrading to a full account. Deliberately excludes a raw guest join (created via a
// friend's trip-invite link, not an ad — see Tech Lead decision, Phase 14).
//
// Novelty is NOT determined by whether a public.users row exists, or by any client-supplied
// "isNew" flag — the on_auth_user_created trigger (20260511000001) always creates the row
// server-side before this ever runs, so that check is always true. Instead, this atomically
// claims a DB column (claimSignupAttribution) exactly once per account; guests are excluded
// via the is_guest check below, and a guest upgrading to a real account naturally succeeds at
// its first claim attempt since guests never claim while still guests. See
// 20260808120000_add_signup_attribution_claim.sql for the full root-cause writeup.
//
// Web fires BOTH the client-side Reddit Pixel and a server-side attribution-capi report,
// sharing one conversionId so Reddit deduplicates them into a single conversion (the pixel
// alone is not resilient to ad blockers; CAPI alone can't see organic non-ad traffic as
// easily) — both gated on the in-app cookie-consent banner (ConsentBanner). Native has no
// pixel to pair with (impossible there), so attribution-capi is its only signal; native also
// has no equivalent banner — attribution there relies on Privacy Policy disclosure of the
// Conversions API transfer (see Part F), not an in-app consent gate. Worth a final legal
// check if that's not the intended posture.
export function maybeTrackSignUp(profile: User): void {
  if (trackedUserId === profile.id || profile.is_guest) return;

  if (Platform.OS === 'web') {
    // No consent decision yet, or declined — log nothing, matching the marketing site's
    // "log nothing without consent" rule (no anonymous-aggregate fallback). Deliberately
    // checked BEFORE claiming: if consent isn't granted yet, the claim stays unspent so a
    // later resolve (after the user accepts) can still fire the conversion.
    const decision = useConsentStore.getState().decision;
    if (decision !== 'granted') return;
    claimSignupAttribution(profile.id)
      .then((claimed) => {
        if (!claimed) return; // already reported previously — most common case (returning user)
        trackedUserId = profile.id;
        const conversionId = Crypto.randomUUID();
        const attribution = getWebAttribution() ?? {};
        trackRedditEvent('SignUp', conversionId);
        reportSignUpAttribution({ surface: 'web_app', conversion_id: conversionId, ...attribution }).catch(() => {
          // Best-effort — a failed attribution report must never surface to the user.
        });
      })
      .catch(() => {});
    return;
  }

  // iOS: never fires. installReferrer.ts (getStoredAttribution) is Android-only — Play
  // Install Referrer has no iOS analogue — so an iOS report would carry no rdt_cid and be
  // unattributable to any campaign. Worse, reporting a first-party user id to Reddit here has
  // no in-app consent gate (see this file's header comment), which on iOS would require App
  // Tracking Transparency (NSUserTrackingUsageDescription + a permission prompt) to stay
  // compliant. Tech Lead decision (iOS build-prep pass): skip native_app reporting on iOS
  // entirely rather than add ATT for an attribution signal that would be empty anyway.
  if (Platform.OS === 'ios') return;

  claimSignupAttribution(profile.id)
    .then((claimed) => {
      if (!claimed) return; // already reported previously — most common case (returning user)
      trackedUserId = profile.id;
      const conversionId = Crypto.randomUUID();
      const attribution = getStoredAttribution() ?? {};
      reportSignUpAttribution({ surface: 'native_app', conversion_id: conversionId, ...attribution }).catch(() => {
        // Best-effort — a failed attribution report must never surface to the user.
      });
    })
    .catch(() => {});
}
