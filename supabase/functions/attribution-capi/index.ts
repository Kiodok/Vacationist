import { createClient } from 'jsr:@supabase/supabase-js@2';

// Called from the app WITH the caller's own session, immediately after a genuine new sign-up
// (see maybeTrackSignUp in apps/mobile/src/features/consent/utils/trackSignUp.ts) — on both
// web (alongside the client-side Reddit Pixel, sharing a conversion_id so Reddit deduplicates
// the two into one conversion) and native (CAPI-only — there is no pixel possible there, so
// this is the only signal). See marketing/site/track.js for how rdt_cid gets from a Reddit ad
// click into the Play Store install referrer in the first place, for the native path.
//
// Unlike track-event, this function requires a real authenticated caller: verify_jwt is left
// at the platform default (true, no supabase/config.toml override) so a request with no/bad
// Authorization header is rejected before this code runs at all. This function additionally
// re-derives the caller's identity itself via auth.getUser(jwt) — the platform's verify_jwt
// check alone would also pass for a request that only carries the anon/publishable key, which
// is not a real user session.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'],
  { auth: { persistSession: false } },
);

// Secret name predates the CAPI v3 migration (2026-08-09) — the value (`a2_jcz7aqtl8eua`) is
// actually the Reddit Pixel ID (same value webPixel.ts's REDDIT_PIXEL_ID uses for the client
// pixel), not an ad account ID. Not renaming the secret itself: the value is already correct
// and renaming means touching the prod secret for no functional gain.
const REDDIT_PIXEL_ID = Deno.env.get('REDDIT_AD_ACCOUNT_ID')!;
const REDDIT_CAPI_ACCESS_TOKEN = Deno.env.get('REDDIT_CAPI_ACCESS_TOKEN')!;
// Set only on dev, only while verifying via Reddit Events Manager → Event Testing — tags
// events with a test_id so they show up there without affecting real ad reporting. Must stay
// unset on prod (see engineering/supabase.md CAPI v3 migration entry).
const REDDIT_CAPI_TEST_ID = Deno.env.get('REDDIT_CAPI_TEST_ID') || null;

const MAX_LEN = 200;

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_LEN) : null;
}

// Narrower than track-event's allowlist: this function is only ever called from an
// authenticated app session (web_app surface), never from the marketing site — so only
// web.vacationist.app (prod) and the local Expo web dev server need to be listed.
const ALLOWED_ORIGINS = new Set([
  'https://web.vacationist.app',
  'http://localhost:8081', // expo start --web
]);

// The browser fetch this function actually receives (via supabase.functions.invoke() in
// reportSignUpAttribution, packages/api/src/analytics.ts) carries an explicit Authorization
// header plus supabase-js's own default headers (apikey, x-client-info) and a JSON
// Content-Type — all four must be preflight-approved or the browser blocks the real request
// even after a successful OPTIONS response. Native callers (no browser, no Origin header) are
// unaffected by any of this — CORS is a browser-only mechanism, and the actual authorization
// check below (auth.getUser) is what protects the endpoint either way.
function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    Vary: 'Origin',
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[attribution-capi] 401: no/malformed Authorization header');
    return new Response('Unauthorized', { status: 401, headers: cors });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    // Never log the token itself — only whether one was present and why validation failed.
    console.error('[attribution-capi] 401: getUser rejected the token —', authError?.message ?? 'no user returned');
    return new Response('Unauthorized', { status: 401, headers: cors });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400, headers: cors });
  }

  const surface = body.surface === 'web_app' || body.surface === 'native_app' ? body.surface : null;
  if (!surface) {
    return new Response('Bad Request', { status: 400, headers: cors });
  }

  // Client-generated, shared with the matching webPixel.trackRedditEvent() pixel call on web
  // (see trackSignUp.ts) — required so Reddit can deduplicate the pixel + CAPI report into one
  // conversion. Always required, even on native (no pixel to dedupe against there), for a
  // consistent contract and because Reddit's own dedup docs recommend an ID on every event.
  const conversionId = clean(body.conversion_id);
  if (!conversionId) {
    return new Response('Bad Request', { status: 400, headers: cors });
  }

  const rdtCid = clean(body.rdt_cid);
  const utmSource = clean(body.utm_source);
  const utmMedium = clean(body.utm_medium);
  const utmCampaign = clean(body.utm_campaign);
  const utmContent = clean(body.utm_content);

  // Always log first-party, regardless of whether there's anything to forward to Reddit —
  // this is what makes an organic sign-up visible in the local funnel dashboard too.
  const { error: logError } = await supabase.from('analytics_events').insert({
    event_name: 'sign_up',
    surface,
    rdt_cid: rdtCid,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    user_agent: (req.headers.get('user-agent') ?? '').slice(0, 500) || null,
    user_id: user.id,
  });
  if (logError) {
    console.error('[attribution-capi] analytics_events insert failed:', logError.message);
  }

  // Every sign-up is reported to Reddit, not just ad-attributed ones (Tech Lead decision,
  // 2026-08-09 CAPI v3 migration) — click_id is attached when present, omitted otherwise.
  // Reddit's schema treats click_id as optional and recommends sending all conversions for
  // volume/optimization signal, even unattributed ones. No `user` match-key object is sent by
  // design (Tech Lead decision) — this stays click_id-only, no new personal data leaves the
  // system.
  try {
    // Endpoint/body shape confirmed against the official v3 reference at
    // https://ads-api.reddit.com/docs/v3/api/post-conversion-events (2026-08-09) — not
    // guessed. See engineering/supabase.md's CAPI v3 migration entry for the full delta from
    // the deprecated v2 shape this replaced.
    const event: Record<string, unknown> = {
      event_at: Date.now(), // int64, Unix epoch MILLISECONDS — v3, not v2's ISO 8601
      action_source: surface === 'web_app' ? 'WEBSITE' : 'APP',
      type: { tracking_type: 'SIGN_UP' }, // v3 UPPER_SNAKE_CASE — was 'SignUp' under v2
      metadata: { conversion_id: conversionId }, // dedup key — nests under metadata in v3
    };
    if (rdtCid) event.click_id = rdtCid;

    const capiRes = await fetch(
      `https://ads-api.reddit.com/api/v3/pixels/${REDDIT_PIXEL_ID}/conversion_events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${REDDIT_CAPI_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          // Reddit throttles default/generic user agents (429) — recommended format is
          // {platform}:{app id}:{version} (by /u/{username}).
          'User-Agent': 'vacationist-capi:com.vacationist.mobile:1.29.0 (by /u/vacationist-app)',
        },
        body: JSON.stringify({
          data: {
            ...(REDDIT_CAPI_TEST_ID ? { test_id: REDDIT_CAPI_TEST_ID } : {}),
            events: [event],
          },
        }),
      },
    );
    const capiText = await capiRes.text();
    if (capiRes.ok) {
      // Logged deliberately — a successful run was previously silent by design, which is part
      // of why this integration's total non-functionality went unnoticed for so long.
      console.log('[attribution-capi] Reddit CAPI accepted the event:', capiText);
    } else {
      console.error('[attribution-capi] Reddit CAPI rejected the event:', capiRes.status, capiText);
    }
  } catch (err) {
    // A Reddit-side failure must never surface to the app — the sign-up itself already
    // succeeded before this function was ever called.
    console.error('[attribution-capi] Reddit CAPI call failed:', err);
  }

  return new Response(null, { status: 204, headers: cors });
});
