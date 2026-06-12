import { useCallback } from 'react';
import { Platform } from 'react-native';
import { signOut, deletePushToken } from '@vacationist/api';
import { useAuthStore } from '../../../stores/authStore';
import { clearUserCache } from '../../../utils/userCache';
import { clearSentryUser } from '../../../utils/sentry';

type GoogleSigninType =
  typeof import('@react-native-google-signin/google-signin').GoogleSignin;

let GoogleSignin: GoogleSigninType | null = null;

if (Platform.OS !== 'web') {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
}

interface SignOutResult {
  handleSignOut: () => void;
}

export function useSignOut(): SignOutResult {
  const pushToken = useAuthStore((s) => s.pushToken);
  const setPushToken = useAuthStore((s) => s.setPushToken);
  const reset = useAuthStore((s) => s.reset);

  const handleSignOut = useCallback(() => {
    // All network calls are fire-and-forget so nothing can hang the sign-out.
    if (Platform.OS !== 'web' && GoogleSignin) {
      GoogleSignin.signOut().catch(() => {});
    }
    if (pushToken) {
      setPushToken(null);
      deletePushToken(pushToken).catch(() => {});
    }
    // Kick off server-side token revocation in the background, then clear
    // local state immediately so navigation to login happens right away.
    signOut().catch(() => {});
    clearUserCache();
    clearSentryUser();
    reset();
  }, [pushToken, setPushToken, reset]);

  return { handleSignOut };
}
