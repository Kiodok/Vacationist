import { createClient } from 'jsr:@supabase/supabase-js@2';

// The repo's first browser-facing Edge Function — push-notification and create-example-trip
// are both server-to-server (pg_net / DB triggers) and have zero CORS handling. This one is
// called directly from anonymous marketing-site visitors and the web app, so it needs an
// origin allowlist, a preflight branch, and defensive input handling that the other two never
// needed. See engineering/software_engineering_guide.md Section 14 / CLAUDE.md "Reddit Pixel
// & Funnel Dashboard" for the surrounding design.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'],
  { auth: { persistSession: false } },
);

const ALLOWED_ORIGINS = new Set([
  'https://vacationist.app',
  'https://web.vacationist.app',
  // Local dev servers only — meaningless to a third party, since only someone already
  // running these locally can ever send a matching Origin header.
  'http://localhost:3000', // npm run web:serve (npx serve dist)
  'http://localhost:3001', // npm run serve:docs
  'http://localhost:8081', // expo start --web
]);

const EVENT_NAMES = new Set([
  'page_visit',
  'play_store_click',
  'app_store_click',
  'web_app_click',
  'app_store_interest',
  'sign_up',
]);

const SURFACES = new Set(['marketing', 'web_app', 'native_app']);

// Matches the CHECK constraints in the analytics_events migration — kept in sync manually,
// same as the event_name/surface allowlists above.
const MAX_LEN: Record<string, number> = {
  path: 500,
  rdt_cid: 200,
  utm_source: 200,
  utm_medium: 200,
  utm_campaign: 200,
  utm_content: 200,
  referrer_host: 255,
};

// Crude but sufficient: reject a request outright if any string field looks like it's
// carrying a raw IP address. This table deliberately has no IP column — this is a second
// line of defense against one being smuggled in through a text field.
const IP_SHAPED = /(?:\d{1,3}\.){3}\d{1,3}|[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}/i;

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

async function visitorHash(req: Request): Promise<string> {
  // IP is used only as ephemeral input to a same-day hash — never stored on its own.
  // The salt is a static Edge Function secret; including today's date is what makes the
  // resulting hash rotate daily even though the salt itself does not change.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua = req.headers.get('user-agent') ?? 'unknown';
  const salt = Deno.env.get('ANALYTICS_VISITOR_HASH_SALT') ?? 'dev-salt';
  const today = new Date().toISOString().split('T')[0];
  const input = `${ip}|${ua}|${salt}|${today}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function clean(value: unknown, field: string): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (IP_SHAPED.test(trimmed)) throw new Error(`rejected: ${field} looks IP-shaped`);
  const max = MAX_LEN[field];
  return max ? trimmed.slice(0, max) : trimmed;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders(origin) });
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > 4096) {
    return new Response('Payload Too Large', { status: 413, headers: corsHeaders(origin) });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400, headers: corsHeaders(origin) });
  }

  const eventName = typeof body.event_name === 'string' ? body.event_name : '';
  const surface = typeof body.surface === 'string' ? body.surface : '';
  if (!EVENT_NAMES.has(eventName) || !SURFACES.has(surface)) {
    return new Response('Bad Request', { status: 400, headers: corsHeaders(origin) });
  }

  // user_id is trusted only when it matches the caller's own session — this endpoint has no
  // session at all (anonymous marketing visitors), so user_id is never accepted from the
  // client. Sign-up attribution for native installs goes through attribution-capi instead,
  // which does carry a caller session.
  let row: Record<string, unknown>;
  try {
    row = {
      event_name: eventName,
      surface,
      path: clean(body.path, 'path'),
      rdt_cid: clean(body.rdt_cid, 'rdt_cid'),
      utm_source: clean(body.utm_source, 'utm_source'),
      utm_medium: clean(body.utm_medium, 'utm_medium'),
      utm_campaign: clean(body.utm_campaign, 'utm_campaign'),
      utm_content: clean(body.utm_content, 'utm_content'),
      referrer_host: clean(body.referrer_host, 'referrer_host'),
      user_agent: (req.headers.get('user-agent') ?? '').slice(0, 500) || null,
      visitor_hash: await visitorHash(req),
    };
  } catch {
    return new Response('Bad Request', { status: 400, headers: corsHeaders(origin) });
  }

  const { error } = await supabase.from('analytics_events').insert(row);
  if (error) {
    console.error('[track-event] insert failed:', error.message);
    return new Response('Internal Server Error', { status: 500, headers: corsHeaders(origin) });
  }

  return new Response(null, { status: 204, headers: corsHeaders(origin) });
});
