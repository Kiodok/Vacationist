import { z } from 'zod';

// Mirrors the CHECK constraints on public.analytics_events
// (supabase/migrations/20260808100000_create_analytics_events.sql, event_name list last
// widened by 20260908130000_add_product_funnel_events.sql). Also mirrored in
// supabase/functions/track-event/index.ts EVENT_NAMES. Keep all three in sync manually.
export const ANALYTICS_EVENT_NAME = [
  'page_visit',
  'play_store_click',
  'app_store_click',
  'web_app_click',
  'app_store_interest',
  'sign_up',
  // Product-funnel events (Growth Plan Q4 2026, Phase 0) — web-app surface only,
  // fired by apps/mobile's trackFeatureEvent helper.
  'trip_created',
  'invite_sent',
  'invite_accepted',
  'expense_added',
] as const;

// The web-app activation-funnel events, fired via trackFeatureEvent (a subset of
// AnalyticsEventName that helper is allowed to send).
export const PRODUCT_FUNNEL_EVENT = [
  'trip_created',
  'invite_sent',
  'invite_accepted',
  'expense_added',
] as const;

export type ProductFunnelEvent = typeof PRODUCT_FUNNEL_EVENT[number];

export type AnalyticsEventName = typeof ANALYTICS_EVENT_NAME[number];

export const ANALYTICS_SURFACE = ['marketing', 'web_app', 'native_app'] as const;

export type AnalyticsSurface = typeof ANALYTICS_SURFACE[number];

export interface AnalyticsEvent {
  id: string;
  event_name: AnalyticsEventName;
  surface: AnalyticsSurface;
  path: string | null;
  rdt_cid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referrer_host: string | null;
  user_agent: string | null;
  visitor_hash: string | null;
  user_id: string | null;
  created_at: string;
}

// Client -> track-event Edge Function payload. user_agent and visitor_hash are computed
// server-side and are never accepted from the client (see track-event/index.ts).
export const logAnalyticsEventSchema = z.object({
  event_name: z.enum(ANALYTICS_EVENT_NAME),
  surface: z.enum(ANALYTICS_SURFACE),
  path: z.string().max(500).optional(),
  rdt_cid: z.string().max(200).optional(),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  referrer_host: z.string().max(255).optional(),
});

export type LogAnalyticsEventInput = z.infer<typeof logAnalyticsEventSchema>;

// Client -> attribution-capi Edge Function payload. Used by both web (alongside the client
// pixel, for Reddit's pixel+CAPI deduplication) and native (CAPI-only — no pixel is possible
// there). Deliberately smaller than LogAnalyticsEventInput — no event_name/path, since this
// endpoint only ever reports one thing (a SignUp) and infers user_id server-side from the
// caller's session.
export const signUpAttributionSchema = z.object({
  surface: z.enum(['web_app', 'native_app']),
  // Client-generated, shared with the matching webPixel.trackRedditEvent() call on web so
  // Reddit can deduplicate the pixel event and this CAPI report as one conversion. Always
  // present (even on native, which has no pixel to dedupe against) for schema consistency.
  conversion_id: z.string().max(100),
  rdt_cid: z.string().max(200).optional(),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
});

export type SignUpAttribution = z.infer<typeof signUpAttributionSchema>;
