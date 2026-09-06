import { useCallback } from 'react';
import { Platform } from 'react-native';
import { signOut, deletePushToken } from '@vacationist/api';
import { useAuthStore } from '../../../stores/authStore';
import { clearUserCache } from '../../../utils/userCache';
import { clearSentryUser } from '../../../utils/sentry';
import { unregisterWebPushAsync } from '../../notifications/utils/unregisterWebPush';
import { clearRestoreKey } from '../utils/restoreCredential';

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
    // Both the web-push subscription delete and the restore-credential row delete need the
    // Supabase session that signOut() is about to clear — chained (not raced) so they run while
    // the session that authorizes them is still valid. Still fire-and-forget from the caller's
    // perspective: reset() below runs immediately, unaffected by this chain's completion.
    Promise.allSettled([unregisterWebPushAsync(), clearRestoreKey()])
      .finally(() => {
        signOut().catch(() => {});
      });
    clearUserCache();
    clearSentryUser();
    reset();
  }, [pushToken, setPushToken, reset]);

  return { handleSignOut };
}
