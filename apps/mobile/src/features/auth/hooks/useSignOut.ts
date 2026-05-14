import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { signOut } from '@vacationist/api';

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
      await signOut();
    } catch {
      onError?.('Sign out failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  return { handleSignOut, loading };
}
