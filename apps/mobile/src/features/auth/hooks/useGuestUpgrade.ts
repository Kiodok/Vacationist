import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { linkGuestWithGoogle, linkGuestWithApple, exchangeAppleAuthCode, linkGuestWithMagicLink } from '@vacationist/api';
import { tryStartGoogleSignIn, endGoogleSignIn } from '../utils/googleSignInGuard';
import { tryStartAppleSignIn, endAppleSignIn } from '../utils/appleSignInGuard';
import { performNativeAppleAuth, isAppleSignInCancelled, maybeSaveAppleName } from '../utils/appleAuth';
import { getConfiguredGoogleSignin } from '../utils/configureGoogleSignin';
import { awaitAppActiveForNativePresent } from '../utils/awaitAppActive';

export function useGuestUpgrade() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const upgradeWithGoogle = useCallback(async (captchaToken?: string) => {
    // configure() the singleton here too — this sheet is reachable without the
    // login screen (which is the only other place it's configured) ever mounting.
    const GoogleSignin = getConfiguredGoogleSignin();
    if (!GoogleSignin || !tryStartGoogleSignIn()) return;
    setIsPending(true);
    setError(null);
    try {
      // See awaitAppActive.ts — a captcha browser fallback right before this can
      // leave iOS with no presented VC, making signIn() raise an un-catchable
      // NSInvalidArgumentException.
      if (!(await awaitAppActiveForNativePresent())) {
        setError('Sign-in failed');
        return;
      }
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.idToken;
      if (!idToken) throw new Error('No ID token from Google');
      await linkGuestWithGoogle(idToken, captchaToken);
      // Auth state change will update the store via onAuthStateChange listener
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      endGoogleSignIn();
      setIsPending(false);
    }
  }, []);

  const upgradeWithApple = useCallback(async (captchaToken?: string) => {
    if (Platform.OS !== 'ios' || !tryStartAppleSignIn()) return;
    setIsPending(true);
    setError(null);
    try {
      const { credential, rawNonce } = await performNativeAppleAuth();

      if (!credential.identityToken) throw new Error('No identity token from Apple');

      const { user } = await linkGuestWithApple(credential.identityToken, rawNonce, captchaToken);

      // Fire-and-forget, started before the awaited name-save below — see the matching
      // comment in useAppleSignIn.ts.
      if (credential.authorizationCode) {
        exchangeAppleAuthCode(credential.authorizationCode).catch(() => {});
      }

      if (user) {
        await maybeSaveAppleName(user.id, credential.fullName);
      }
      // Auth state change will update the store via onAuthStateChange listener
    } catch (e: unknown) {
      if (isAppleSignInCancelled(e)) return;
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      endAppleSignIn();
      setIsPending(false);
    }
  }, []);

  const upgradeWithMagicLink = useCallback(async (email: string): Promise<boolean> => {
    setIsPending(true);
    setError(null);
    try {
      const redirectTo = Platform.OS === 'web' ? window.location.origin : 'vacationist://';
      await linkGuestWithMagicLink(email, redirectTo);
      setMagicLinkSent(true);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send link');
      return false;
    } finally {
      setIsPending(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { upgradeWithGoogle, upgradeWithApple, upgradeWithMagicLink, isPending, error, magicLinkSent, clearError };
}
