// Builds the ES256-signed JWT Apple requires as `client_secret` for both the
// /auth/token (code exchange) and /auth/revoke endpoints. Shared by
// apple-token-exchange and revoke-apple-token — both need an identical, short-lived
// (5 min — minted fresh per request, never cached/reused) secret.
//
// sub/client_id is the app's Bundle ID here (com.vacationist.mobile), not the Services ID —
// Apple's native (AuthenticationServices) sign-in mints identityToken/authorizationCode with
// `aud` = the Bundle ID, so the token/revoke exchange must use the Bundle ID as client_id too.
// The Services ID only matters for the web OAuth redirect flow, which this app doesn't use for
// Apple (native-only, iOS-gated).

function base64url(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromString(s: string): string {
  return base64url(new TextEncoder().encode(s));
}

async function importApplePrivateKey(pem: string): Promise<CryptoKey> {
  const stripped = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(stripped), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

export async function generateAppleClientSecret(): Promise<string> {
  const teamId = Deno.env.get('APPLE_TEAM_ID')!;
  const keyId = Deno.env.get('APPLE_KEY_ID')!;
  const privateKeyPem = Deno.env.get('APPLE_PRIVATE_KEY')!;
  const clientId = Deno.env.get('APPLE_CLIENT_ID')!; // com.vacationist.mobile

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 300,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };

  const signingInput = `${base64urlFromString(JSON.stringify(header))}.${base64urlFromString(JSON.stringify(payload))}`;
  const key = await importApplePrivateKey(privateKeyPem);
  // WebCrypto's ECDSA P-256 signature is already raw (r||s, 64 bytes) — exactly the format
  // JWS ES256 requires, no DER conversion needed.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}
