import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from 'jsr:@simplewebauthn/server@13';

// Phase 17 — Android Zero-Tap Sign-In (Google Play technical-quality requirement, enforced
// April 2027). The Android Restore Credentials API is WebAuthn: this function issues the
// registration/authentication option blobs the native Credential Manager needs, and verifies
// the responses server-side before minting a Supabase session.
//
// action dispatch:
//   register-options  (auth)   → PublicKeyCredentialCreationOptionsJSON
//   register-verify   (auth)   → stores public key in public.restore_credentials
//   auth-options      (NO auth)→ PublicKeyCredentialRequestOptionsJSON
//   auth-verify       (NO auth)→ verifies assertion, returns a magic-link token hash
//
// verify_jwt is false (see supabase/config.toml) because auth-* run on a brand-new device
// with no session at all. The unauthenticated half is gated instead by a single-use,
// 2-minute, server-issued challenge row plus full ES256 assertion-signature verification.
// register-* re-derive identity with auth.getUser(jwt) — verify_jwt=false alone would pass a
// request bearing only the publishable/anon key.
//
// No CORS layer: this function is only ever called from the native Android app (isSupported()
// is false on web/iOS, so the client never invokes it there). A native request carries no
// Origin header, so an origin allowlist like track-event's would wrongly reject it.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'],
  { auth: { persistSession: false } },
);

const RP_ID = 'vacationist.app';
const RP_NAME = 'Vacationist';
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

// Android WebAuthn origin is `android:apk-key-hash:<base64url(SHA-256(signing cert))>`, NOT an
// https origin. The default is the Play App Signing certificate hash (same fingerprint as
// docs/.well-known/assetlinks.json) — it covers production + the internal-testing track, both
// re-signed by Google Play. Additional hashes (e.g. an EAS upload keystore for direct-install
// preview APKs) can be added via the RESTORE_EXTRA_APK_KEY_HASHES secret (comma-separated
// base64url hashes, without the `android:apk-key-hash:` prefix).
// base64url (no padding) is what current Android emits; the padded/standard forms are listed
// too, defensively, since the exact encoding has varied by platform version historically.
const DEFAULT_APK_KEY_HASHES = [
  'FOizwfJx0qKH82cPicZt7WotWIJ7bx_37fC96H9TtIk',      // base64url, no padding (expected)
  'FOizwfJx0qKH82cPicZt7WotWIJ7bx/37fC96H9TtIk',      // standard base64, no padding
  'FOizwfJx0qKH82cPicZt7WotWIJ7bx/37fC96H9TtIk=',     // standard base64, padded
];
const EXPECTED_ORIGINS = [
  ...DEFAULT_APK_KEY_HASHES,
  ...(Deno.env.get('RESTORE_EXTRA_APK_KEY_HASHES') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
].map((h) => `android:apk-key-hash:${h}`);

// ── base64url helpers ───────────────────────────────────────────────────────
function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  return user;
}

// ────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  const action = typeof body.action === 'string' ? body.action : '';

  try {
    // ── register-options ────────────────────────────────────────────────────
    if (action === 'register-options') {
      const user = await requireUser(req);
      if (!user) return new Response('Unauthorized', { status: 401 });
      if (user.is_anonymous || !user.email) {
        // Guests have no email — generateLink can't restore them later. Nothing to do.
        return json({ error: 'no_email' }, 400);
      }

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: user.email,
        userID: new TextEncoder().encode(user.id),
        attestationType: 'none',
        supportedAlgorithmIDs: [-7], // ES256 — the only algorithm Credential Manager issues here
        // Restore credentials do no user verification; the platform picks the authenticator.
        authenticatorSelection: { userVerification: 'discouraged' },
        timeout: CHALLENGE_TTL_MS,
      });

      await supabase.from('restore_credential_challenges').insert({
        challenge: options.challenge,
        user_id: user.id,
        purpose: 'register',
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      });

      return json({ registrationJson: JSON.stringify(options) });
    }

    // ── register-verify ─────────────────────────────────────────────────────
    if (action === 'register-verify') {
      const user = await requireUser(req);
      if (!user) return new Response('Unauthorized', { status: 401 });

      const raw = typeof body.registrationResponseJson === 'string' ? body.registrationResponseJson : '';
      if (!raw) return new Response('Bad Request', { status: 400 });
      const response = JSON.parse(raw);

      const { data: challengeRow } = await supabase
        .from('restore_credential_challenges')
        .select('id, challenge')
        .eq('user_id', user.id)
        .eq('purpose', 'register')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!challengeRow) {
        console.error('[restore-credential] register-verify: no valid challenge for user');
        return json({ error: 'no_challenge' }, 400);
      }

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: EXPECTED_ORIGINS,
        expectedRPID: RP_ID,
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.registrationInfo) {
        console.error('[restore-credential] register-verify: verification failed');
        return json({ error: 'verification_failed' }, 400);
      }

      const cred = verification.registrationInfo.credential;
      // Replace any prior credential for this user (re-register on a new device).
      await supabase.from('restore_credentials').delete().eq('user_id', user.id);
      const { error: insErr } = await supabase.from('restore_credentials').insert({
        user_id: user.id,
        credential_id: cred.id,
        public_key: bytesToB64url(cred.publicKey),
        sign_count: cred.counter ?? 0,
        aaguid: verification.registrationInfo.aaguid ?? null,
      });
      if (insErr) {
        console.error('[restore-credential] register-verify: insert failed —', insErr.message);
        return new Response('Internal Server Error', { status: 500 });
      }

      await supabase
        .from('restore_credential_challenges')
        .delete()
        .eq('user_id', user.id)
        .eq('purpose', 'register');

      return new Response(null, { status: 204 });
    }

    // ── register-clear ──────────────────────────────────────────────────────
    if (action === 'register-clear') {
      const user = await requireUser(req);
      if (!user) return new Response('Unauthorized', { status: 401 });
      await supabase.from('restore_credentials').delete().eq('user_id', user.id);
      return new Response(null, { status: 204 });
    }

    // ── auth-options (no session) ───────────────────────────────────────────
    if (action === 'auth-options') {
      // No allowCredentials — there's no session to scope by. The device offers whatever
      // restore credential it holds; auth-verify then looks it up by credential id.
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        userVerification: 'discouraged',
        timeout: CHALLENGE_TTL_MS,
      });

      await supabase.from('restore_credential_challenges').insert({
        challenge: options.challenge,
        user_id: null,
        purpose: 'authenticate',
        expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
      });

      return json({ authenticationJson: JSON.stringify(options) });
    }

    // ── auth-verify (no session) ────────────────────────────────────────────
    if (action === 'auth-verify') {
      const raw = typeof body.assertionResponseJson === 'string' ? body.assertionResponseJson : '';
      if (!raw) return new Response('Bad Request', { status: 400 });
      const response = JSON.parse(raw);

      const credentialId: string = response.id ?? response.rawId ?? '';
      if (!credentialId) return json({ error: 'no_credential_id' }, 400);

      const { data: cred } = await supabase
        .from('restore_credentials')
        .select('id, user_id, credential_id, public_key, sign_count')
        .eq('credential_id', credentialId)
        .maybeSingle();

      if (!cred) {
        console.error('[restore-credential] auth-verify: unknown credential id');
        return json({ error: 'unknown_credential' }, 400);
      }

      // The challenge lives inside clientDataJSON — match it to a live 'authenticate' row.
      let clientChallenge = '';
      try {
        const clientData = JSON.parse(new TextDecoder().decode(b64urlToBytes(response.response.clientDataJSON)));
        clientChallenge = clientData.challenge ?? '';
      } catch {
        return json({ error: 'bad_client_data' }, 400);
      }

      const { data: challengeRow } = await supabase
        .from('restore_credential_challenges')
        .select('id, challenge')
        .eq('challenge', clientChallenge)
        .eq('purpose', 'authenticate')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!challengeRow) {
        console.error('[restore-credential] auth-verify: no valid challenge');
        return json({ error: 'no_challenge' }, 400);
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge: challengeRow.challenge,
          expectedOrigin: EXPECTED_ORIGINS,
          expectedRPID: RP_ID,
          requireUserVerification: false,
          credential: {
            id: cred.credential_id,
            publicKey: b64urlToBytes(cred.public_key),
            counter: Number(cred.sign_count),
          },
        });
      } catch (e) {
        console.error('[restore-credential] auth-verify: verification threw —', (e as Error).message);
        return json({ error: 'verification_failed' }, 400);
      }

      if (!verification.verified) {
        console.error('[restore-credential] auth-verify: verification not verified');
        return json({ error: 'verification_failed' }, 400);
      }

      // Consume the challenge and advance the signature counter.
      await supabase.from('restore_credential_challenges').delete().eq('id', challengeRow.id);
      await supabase
        .from('restore_credentials')
        .update({
          sign_count: verification.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', cred.id);

      const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(cred.user_id);
      if (userErr || !userData?.user?.email) {
        console.error('[restore-credential] auth-verify: user has no email —', userErr?.message ?? 'none');
        return json({ error: 'no_email' }, 400);
      }

      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: userData.user.email,
      });
      if (linkErr || !linkData?.properties?.hashed_token) {
        console.error('[restore-credential] auth-verify: generateLink failed —', linkErr?.message ?? 'none');
        return new Response('Internal Server Error', { status: 500 });
      }

      return json({ tokenHash: linkData.properties.hashed_token });
    }

    return new Response('Bad Request', { status: 400 });
  } catch (e) {
    console.error('[restore-credential] unhandled error —', (e as Error).message);
    return new Response('Internal Server Error', { status: 500 });
  }
});
