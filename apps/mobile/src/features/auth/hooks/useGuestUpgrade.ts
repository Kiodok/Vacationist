import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { linkGuestWithGoogle, linkGuestWithMagicLink } from '@vacationist/api';

type GoogleSigninType = typeof import('@react-native-google-signin/google-signin').GoogleSignin;
let GoogleSignin: GoogleSigninType | null = null;
if (Platform.OS !== 'web') {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
}

export function useGuestUpgrade() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const upgradeWithGoogle = useCallback(async () => {
    if (!GoogleSignin) return;
    setIsPending(true);
    setError(null);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.idToken;
      if (!idToken) throw new Error('No ID token from Google');
      await linkGuestWithGoogle(idToken);
      // Auth state change will update the store via onAuthStateChange listener
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setIsPending(false);
    }
  }, []);

  const upgradeWithMagicLink = useCallback(async (email: string) => {
    setIsPending(true);
    setError(null);
    try {
      const redirectTo = Platform.OS === 'web' ? window.location.origin : 'vacationist://';
      await linkGuestWithMagicLink(email, redirectTo);
      setMagicLinkSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send link');
    } finally {
      setIsPending(false);
    }
  }, []);

  return { upgradeWithGoogle, upgradeWithMagicLink, isPending, error, magicLinkSent };
}
