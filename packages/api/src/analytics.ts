import { supabase } from './client';
import type { LogAnalyticsEventInput, SignUpAttribution } from '@vacationist/types';

// Calls the track-event Edge Function (supabase/functions/track-event) — the funnel event
// log for the local dashboard, separate from the Reddit Pixel itself. user_agent and
// visitor_hash are computed server-side and are not part of the input here.
//
// Callers must treat this as best-effort: analytics must never block or fail a user-facing
// flow (sign-in, navigation, etc.). This function still throws on error, consistent with the
// rest of packages/api — swallow at the call site, not here, so the boundary stays honest.
export async function logAnalyticsEvent(input: LogAnalyticsEventInput): Promise<void> {
  const { error } = await supabase.functions.invoke('track-event', { body: input });
  if (error) throw error;
}

// Calls the attribution-capi Edge Function (supabase/functions/attribution-capi). Used on
// both surfaces: on web, alongside the client-side Reddit Pixel (same conversion_id on both,
// for Reddit's pixel+CAPI deduplication); on native there is no pixel to pair with, so this is
// the only signal. Only when `rdt_cid` is present does the Edge Function forward the
// conversion server-to-server to Reddit's Conversions API — it always logs first-party
// regardless. Same best-effort contract as logAnalyticsEvent: throws here, swallow at the
// call site.
//
// The access token is fetched and attached explicitly (functions.invoke's own automatic
// Authorization injection depends on internal client-library timing — it re-reads the current
// session inside its fetch wrapper, which is not guaranteed to have settled in the moment
// right after a sign-in event resolves, exactly when this is called from trackSignUp.ts).
// Explicit is simpler to reason about and matches this codebase's existing Auth Pattern rule
// of reading getSession() directly rather than relying on implicit behavior.
export async function reportSignUpAttribution(attribution: SignUpAttribution): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session — cannot report sign-up attribution');
  const { error } = await supabase.functions.invoke('attribution-capi', {
    body: attribution,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
}
