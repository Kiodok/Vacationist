import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { updateUserProfile } from '@vacationist/api';

// Shared by useAppleSignIn.ts (fresh sign-in) and useGuestUpgrade.ts (guest → full account) —
// both need identical nonce generation, the native signInAsync() call, cancellation detection,
// and the fullName-capture-on-first-authorization quirk. Only what happens with the resulting
// identityToken differs (signInWithAppleIdToken vs linkGuestWithApple), so that part stays in
// each hook.

export async function performNativeAppleAuth(): Promise<{
  credential: AppleAuthentication.AppleAuthenticationCredential;
  rawNonce: string;
}> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  return { credential, rawNonce };
}

export function isAppleSignInCancelled(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code: string }).code === 'ERR_REQUEST_CANCELED'
  );
}

// Apple only returns `fullName` the very first time a user authorizes this app — every
// subsequent sign-in gets `null` for every field. Callers only ever invoke this right after a
// fresh signInAsync() response, so a null/empty fullName here is simply "not the first
// authorization" and is always a safe no-op — it never overwrites an existing name.
export async function maybeSaveAppleName(
  userId: string,
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): Promise<void> {
  if (!fullName) return;
  const formatted = AppleAuthentication.formatFullName(fullName)?.trim();
  if (!formatted) return;
  try {
    await updateUserProfile(userId, { name: formatted });
  } catch {
    // Non-fatal — the user keeps the trigger-assigned default name ("User") and can rename
    // themselves in Profile settings. Sign-in itself has already succeeded by this point.
  }
}
