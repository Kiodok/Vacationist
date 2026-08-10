import { createClient } from 'jsr:@supabase/supabase-js@2';
import { generateAppleClientSecret } from '../_shared/appleClientSecret.ts';

// Called once, immediately after a fresh native Apple sign-in (see useAppleSignIn.ts),
// passing the authorizationCode from AppleAuthentication.signInAsync(). Exchanges it with
// Apple for a refresh_token and stores it (encrypted) via store_apple_refresh_token — this is
// what makes later account-deletion revocation (revoke-apple-token) possible. The
// authorizationCode itself is single-use and expires in minutes, so this exchange cannot be
// deferred to deletion time.
//
// Best-effort by contract: the caller (useAppleSignIn.ts) must treat failure here as
// non-fatal — sign-in has already succeeded via signInWithAppleIdToken before this runs. A
// user who signs in while this call fails simply won't have their token revocable later,
// which is an acceptable degraded case, not a blocker to using the app.
//
// verify_jwt is left at the platform default (true) — same posture as attribution-capi. This
// function also re-derives identity itself via auth.getUser(jwt) since verify_jwt alone would
// also pass a request bearing only the anon/publishable key.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'],
  { auth: { persistSession: false } },
);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[apple-token-exchange] 401: no/malformed Authorization header');
    return new Response('Unauthorized', { status: 401 });
  }

  const jwt = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    console.error('[apple-token-exchange] 401: getUser rejected the token —', authError?.message ?? 'no user returned');
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const authorizationCode = typeof body.authorizationCode === 'string' ? body.authorizationCode : null;
  if (!authorizationCode) {
    return new Response('Bad Request', { status: 400 });
  }

  try {
    const clientSecret = await generateAppleClientSecret();
    const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('APPLE_CLIENT_ID')!,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
      }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.refresh_token) {
      console.error('[apple-token-exchange] Apple token exchange failed:', tokenRes.status, JSON.stringify(tokenJson));
      return new Response('Bad Gateway', { status: 502 });
    }

    // RPC call authenticated as the caller (their own JWT, not the service-role client above)
    // so auth.uid() inside store_apple_refresh_token resolves to this user.
    const userScoped = createClient(
      Deno.env.get('SUPABASE_URL')!,
      JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'],
      { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { error: rpcError } = await userScoped.rpc('store_apple_refresh_token', {
      p_refresh_token: tokenJson.refresh_token,
    });
    if (rpcError) {
      console.error('[apple-token-exchange] store_apple_refresh_token failed:', rpcError.message);
      return new Response('Internal Server Error', { status: 500 });
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[apple-token-exchange] Unexpected error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
});
