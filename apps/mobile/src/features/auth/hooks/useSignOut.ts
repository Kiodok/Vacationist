import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { signOut, deletePushToken } from '@vacationist/api';
import { useAuthStore } from '../../../stores/authStore';

type GoogleSigninType =
  typeof import('@react-native-google-signin/google-signin').GoogleSignin;

let GoogleSignin: GoogleSigninType | null = null;

if (Platform.OS !== 'web') {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
}

interface SignOutResult {
  handleSignOut: () => Promise<void>;
  loading: boolean;
}

export function useSignOut(onError?: (message: string) => void): SignOutResult {
  const [loading, setLoading] = useState(false);
  const pushToken = useAuthStore((s) => s.pushToken);
  const setPushToken = useAuthStore((s) => s.setPushToken);

  const handleSignOut = useCallback(async () => {
    setLoading(true);
    try {
      if (Platform.OS !== 'web' && GoogleSignin) {
        try {
          await GoogleSignin.signOut();
        } catch {
          // Google sign-out failure is non-critical
        }
      }
      // Delete push token while session is still valid
      if (pushToken) {
        setPushToken(null);
        await deletePushToken(pushToken).catch(() => {});
      }
      await signOut();
    } catch {
      onError?.('Sign out failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onError, pushToken, setPushToken]);

  return { handleSignOut, loading };
}
