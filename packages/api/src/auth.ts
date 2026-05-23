import { supabase } from './client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export async function getGoogleOAuthUrl(redirectTo: string): Promise<string> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  return data.url;
}

export async function signInWithMagicLink(email: string, redirectTo: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });
  if (error) throw error;
  return data;
}

export async function signInAnonymously(metadata?: Record<string, string>) {
  const { data, error } = await supabase.auth.signInAnonymously({
    options: metadata ? { data: metadata } : undefined,
  });
  if (error) throw error;
  return data;
}

export async function setSessionFromUrl(url: string) {
  const parsedUrl = new URL(url);
  const fragment = parsedUrl.hash ? parsedUrl.hash.substring(1) : '';
  const params = new URLSearchParams(fragment || parsedUrl.search);

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    throw new Error('Missing tokens in callback URL');
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) throw error;
  return data;
}

export async function signInWithGoogleIdToken(idToken: string) {
  if (!idToken) {
    throw new Error('Google ID token is required');
  }
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data;
}

export async function linkGuestWithGoogle(idToken: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  if (error) throw error;
  return data;
}

export async function linkGuestWithMagicLink(email: string, redirectTo: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    // Global revocation failed (e.g. expired token, network error).
    // Clear the local session so the user is always signed out on this device.
    await supabase.auth.signOut({ scope: 'local' });
  }
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
