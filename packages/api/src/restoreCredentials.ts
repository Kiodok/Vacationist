import { supabase } from './client';
import type { RestoreAuthenticationVerifyResponse } from '@vacationist/types';

// Phase 17 — Android Zero-Tap Sign-In. Thin wrappers over the `restore-credential` Edge
// Function (supabase/functions/restore-credential), which is `action`-dispatched.
//
// register-* run with a real session (a freshly signed-in user creating their restore key).
// auth-* run with NO session (a brand-new device with nothing restored yet) — the Edge
// Function's verify_jwt is false for that reason, and the flow is gated instead by a
// server-issued single-use challenge plus WebAuthn signature verification.
//
// All four throw on error, per the packages/api convention — callers swallow, because a
// failed restore-credential round-trip must never block sign-in or app start.

/** Authenticated. Returns the WebAuthn PublicKeyCredentialCreationOptionsJSON string to feed
 * into the native `createRestoreKey`. */
export async function getRestoreRegistrationOptions(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session — cannot start restore-credential registration');
  const { data, error } = await supabase.functions.invoke('restore-credential', {
    body: { action: 'register-options' },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
  return (data as { registrationJson: string }).registrationJson;
}

/** Authenticated. `registrationResponseJson` comes straight from the native `createRestoreKey`. */
export async function verifyRestoreRegistration(registrationResponseJson: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session — cannot verify restore-credential registration');
  const { error } = await supabase.functions.invoke('restore-credential', {
    body: { action: 'register-verify', registrationResponseJson },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
}

/** Unauthenticated (new device). Returns the WebAuthn PublicKeyCredentialRequestOptionsJSON
 * string to feed into the native `getRestoreKey`. */
export async function getRestoreAuthenticationOptions(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('restore-credential', {
    body: { action: 'auth-options' },
  });
  if (error) throw error;
  return (data as { authenticationJson: string }).authenticationJson;
}

/** Unauthenticated (new device). Verifies the assertion server-side and returns a magic-link
 * token hash to exchange for a session via `signInWithRestoreTokenHash`. */
export async function verifyRestoreAuthentication(
  assertionResponseJson: string,
): Promise<RestoreAuthenticationVerifyResponse> {
  const { data, error } = await supabase.functions.invoke('restore-credential', {
    body: { action: 'auth-verify', assertionResponseJson },
  });
  if (error) throw error;
  return data as RestoreAuthenticationVerifyResponse;
}

/** Authenticated. Deletes the caller's server-side restore credential row (called on sign-out,
 * alongside the native `clearRestoreKey`). No-ops server-side if there is no row. */
export async function deleteRestoreCredential(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session — cannot delete restore credential');
  const { error } = await supabase.functions.invoke('restore-credential', {
    body: { action: 'register-clear' },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
}

/** Exchanges the token hash from `verifyRestoreAuthentication` for a real Supabase session.
 * `generateLink({ type: 'magiclink' })` server-side never sends an email — the hash is
 * consumed directly here, the same primitive a clicked magic link uses. */
export async function signInWithRestoreTokenHash(tokenHash: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (error) throw error;
  return data;
}
