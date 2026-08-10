import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { deleteOwnAccount, deletePushToken, revokeAppleToken, signOut } from '@vacationist/api';
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

interface DeleteAccountResult {
  handleDeleteAccount: () => Promise<void>;
  isDeleting: boolean;
}

export function useDeleteAccount(): DeleteAccountResult {
  const pushToken = useAuthStore((s) => s.pushToken);
  const setPushToken = useAuthStore((s) => s.setPushToken);
  const reset = useAuthStore((s) => s.reset);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = useCallback(async () => {
    setIsDeleting(true);
    try {
      // Best-effort, and deliberately BEFORE deleteOwnAccount(): revocation needs the
      // encrypted Apple refresh token, which deleteOwnAccount()'s cascade removes. A failed
      // revocation (network error, user never linked Apple, etc.) must never block deletion —
      // see revoke-apple-token's doc comment. Not platform-gated: Apple Sign-In is offered
      // iOS-only, but the resulting account can be deleted from any platform (Android, web),
      // so this must run regardless of the deleting device's OS. revoke-apple-token already
      // no-ops safely (204) when the caller never linked Apple.
      await revokeAppleToken().catch(() => {});

      // Server-side deletion must succeed before we clear local state.
      // If it throws, the user stays logged in with their account intact.
      await deleteOwnAccount();
    } catch (err) {
      setIsDeleting(false);
      throw err;
    }

    // Deletion succeeded — clean up local state (fire-and-forget, same as sign-out).
    if (Platform.OS !== 'web' && GoogleSignin) {
      GoogleSignin.signOut().catch(() => {});
    }
    if (pushToken) {
      setPushToken(null);
      deletePushToken(pushToken).catch(() => {});
    }
    signOut().catch(() => {});
    clearUserCache();
    clearSentryUser();
    reset();
    // No need to setIsDeleting(false) — reset() unmounts this screen.
  }, [pushToken, setPushToken, reset]);

  return { handleDeleteAccount, isDeleting };
}
