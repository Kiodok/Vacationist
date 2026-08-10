import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { signInWithAppleIdToken, exchangeAppleAuthCode } from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
import { tryStartAppleSignIn, endAppleSignIn } from '../utils/appleSignInGuard';
import { performNativeAppleAuth, isAppleSignInCancelled, maybeSaveAppleName } from '../utils/appleAuth';

interface AppleSignInResult {
  signIn: (captchaToken?: string) => Promise<void>;
  loading: boolean;
}

export function useAppleSignIn(onError: (message: string) => void): AppleSignInResult {
  const [loading, setLoading] = useState(false);

  const signIn = useCallback(async (captchaToken?: string) => {
    if (Platform.OS !== 'ios' || !tryStartAppleSignIn()) return;
    setLoading(true);
    try {
      const { credential, rawNonce } = await performNativeAppleAuth();

      if (!credential.identityToken) {
        throw new Error(i18n.t('auth:login.appleNoToken'));
      }

      const { user } = await signInWithAppleIdToken(credential.identityToken, rawNonce, captchaToken);

      // Fire-and-forget, started before the awaited name-save below: capturing the refresh
      // token for later revocation is time-sensitive (the authorizationCode is single-use and
      // expires in minutes), so it must not wait on an unrelated round trip. See
      // exchangeAppleAuthCode's doc comment in packages/api/src/auth.ts.
      if (credential.authorizationCode) {
        exchangeAppleAuthCode(credential.authorizationCode).catch(() => {});
      }

      if (user) {
        await maybeSaveAppleName(user.id, credential.fullName);
      }
    } catch (error: unknown) {
      if (isAppleSignInCancelled(error)) return;
      if (__DEV__) {
        console.error('[AppleSignIn] Error:', error);
      }
      onError(i18n.t('auth:login.appleFailed'));
    } finally {
      endAppleSignIn();
      setLoading(false);
    }
  }, [onError]);

  return { signIn, loading };
}
