import { createClient } from 'jsr:@supabase/supabase-js@2';
import { generateAppleClientSecret } from '../_shared/appleClientSecret.ts';

// Called once, right before deleteOwnAccount() (see useDeleteAccount.ts) — Apple App Review
// Guideline 5.1.1(v) requires apps supporting Sign in with Apple to revoke the user's token on
// account deletion. No-ops cleanly (204) if the caller never linked Apple — most users.
//
// Deliberately does NOT touch delete_own_account() itself: this runs as a separate pre-step
// from the client, so the already-carefully-patched deletion function (see CLAUDE.md's Account
// Deletion section) stays untouched. Best-effort by contract — useDeleteAccount.ts must
// proceed to deleteOwnAccount() regardless of this call's outcome; a failed Apple-side
// revocation must never block a user from deleting their account.
//
// verify_jwt left at the platform default (true) — same posture as attribution-capi /
// apple-token-exchange.

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
    console.error('[revoke-apple-token] 401: no/malformed Authorization header');
    return new Response('Unauthorized', { status: 401 });
  }

  const jwt = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    console.error('[revoke-apple-token] 401: getUser rejected the token —', authError?.message ?? 'no user returned');
    return new Response('Unauthorized', { status: 401 });
  }

  const userScoped = createClient(
    Deno.env.get('SUPABASE_URL')!,
    JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'],
    { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );

  try {
    const { data: refreshToken, error: rpcError } = await userScoped.rpc('get_own_apple_refresh_token');
    if (rpcError) {
      console.error('[revoke-apple-token] get_own_apple_refresh_token failed:', rpcError.message);
      return new Response('Internal Server Error', { status: 500 });
    }

    if (!refreshToken) {
      // Never linked Apple, or the encryption key was unavailable — nothing to revoke.
      return new Response(null, { status: 204 });
    }

    const clientSecret = await generateAppleClientSecret();
    const revokeRes = await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('APPLE_CLIENT_ID')!,
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: 'refresh_token',
      }),
    });

    if (!revokeRes.ok) {
      const text = await revokeRes.text();
      console.error('[revoke-apple-token] Apple revoke call failed:', revokeRes.status, text);
      // Do not delete the stored token on failure — leave it for a possible retry.
      return new Response('Bad Gateway', { status: 502 });
    }

    const { error: deleteError } = await userScoped.rpc('delete_own_apple_refresh_token');
    if (deleteError) {
      console.error('[revoke-apple-token] delete_own_apple_refresh_token failed:', deleteError.message);
      // Revocation itself succeeded — the leftover encrypted row is inert at this point
      // (Apple already rejects the revoked token), so this is a cleanup nicety, not an error.
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[revoke-apple-token] Unexpected error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
});
