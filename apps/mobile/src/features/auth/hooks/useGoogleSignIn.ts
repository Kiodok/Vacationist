import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { signInWithGoogleIdToken } from '@vacationist/api';

type GoogleSigninType =
  typeof import('@react-native-google-signin/google-signin').GoogleSignin;
type StatusCodesType =
  typeof import('@react-native-google-signin/google-signin').statusCodes;

let GoogleSignin: GoogleSigninType | null = null;
let statusCodes: StatusCodesType | null = null;

if (Platform.OS !== 'web') {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
  statusCodes = mod.statusCodes;
}

let getGoogleOAuthUrl: typeof import('@vacationist/api').getGoogleOAuthUrl | null =
  null;
if (Platform.OS === 'web') {
  const api = require('@vacationist/api');
  getGoogleOAuthUrl = api.getGoogleOAuthUrl;
  const WebBrowser = require('expo-web-browser');
  WebBrowser.maybeCompleteAuthSession();
}

interface GoogleSignInResult {
  signIn: () => Promise<void>;
  loading: boolean;
}

export function useGoogleSignIn(
  onError: (message: string) => void,
): GoogleSignInResult {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' && GoogleSignin) {
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      });
    }
  }, []);

  const signIn = useCallback(async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        const { makeRedirectUri } = require('expo-auth-session');
        const redirectTo = makeRedirectUri() as string;
        const url = await getGoogleOAuthUrl!(redirectTo);
        window.location.href = url;
        return;
      }

      if (!GoogleSignin) {
        throw new Error('Google Sign-In is not available');
      }

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      if (__DEV__) {
        console.log('[GoogleSignIn] webClientId:', process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
      }

      const response = await GoogleSignin.signIn();

      if (__DEV__) {
        console.log('[GoogleSignIn] response type:', response.type);
        console.log('[GoogleSignIn] has data:', 'data' in response);
        console.log('[GoogleSignIn] has idToken:', !!response.data?.idToken);
      }

      if (!('data' in response) || !response.data?.idToken) {
        throw new Error(
          'No ID token received from Google. Verify your Google Web Client ID is configured correctly.',
        );
      }

      if (__DEV__) {
        console.log('[GoogleSignIn] idToken length:', response.data.idToken.length);
        console.log('[GoogleSignIn] Calling signInWithGoogleIdToken...');
      }

      await signInWithGoogleIdToken(response.data.idToken);

      if (__DEV__) {
        console.log('[GoogleSignIn] Supabase signInWithIdToken succeeded');
      }
    } catch (error: unknown) {
      if (__DEV__) {
        console.error('[GoogleSignIn] Error:', error);
      }
      if (
        statusCodes &&
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === statusCodes.SIGN_IN_CANCELLED
      ) {
        return;
      }
      onError('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  return { signIn, loading };
}
