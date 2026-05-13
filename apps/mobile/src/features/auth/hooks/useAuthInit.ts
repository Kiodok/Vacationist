import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import {
  getSession,
  ensureUserProfile,
  onAuthStateChange,
  setSessionFromUrl,
} from '@vacationist/api';
import { useAuthStore } from '../../../stores/authStore';

export function useAuthInit() {
  const setUser = useAuthStore((s) => s.setUser);
  const setHasSession = useAuthStore((s) => s.setHasSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    let mounted = true;

    // On web, capture auth tokens from the URL hash right now — this
    // effect fires before the AuthGate redirect effect (call order),
    // so the hash is still intact.
    let webAuthUrl: string | null = null;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const href = window.location.href;
      if (href.includes('access_token') || href.includes('refresh_token')) {
        webAuthUrl = href;
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        );
      }
    }

    async function loadSession() {
      try {
        const session = await getSession();
        if (!mounted) return;

        if (session) {
          setHasSession(true);
          const profile = await ensureUserProfile(session);
          if (mounted) setUser(profile);
        }
      } catch {
        if (mounted) reset();
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function processAuthTokens(url: string) {
      try {
        await setSessionFromUrl(url);
      } catch {
        // Token extraction failed — loadSession handles the fallback
      }
    }

    if (webAuthUrl) {
      processAuthTokens(webAuthUrl).finally(() => {
        if (mounted) loadSession();
      });
    } else {
      loadSession();

      if (Platform.OS !== 'web') {
        Linking.getInitialURL().then(async (url) => {
          if (!url || !mounted) return;
          if (url.includes('access_token') || url.includes('refresh_token')) {
            try {
              await setSessionFromUrl(url);
            } catch {
              // handled by onAuthStateChange
            }
          }
        });
      }
    }

    const linkSub = Linking.addEventListener('url', async ({ url }) => {
      if (!url || !mounted) return;
      if (url.includes('access_token') || url.includes('refresh_token')) {
        try {
          await setSessionFromUrl(url);
        } catch {
          // handled by onAuthStateChange
        }
      }
    });

    // IMPORTANT: this callback must NOT be async. Supabase's GoTrue
    // client awaits listener return values during setSession — if the
    // callback awaits a Supabase API call (like ensureUserProfile), it
    // deadlocks because setSession still holds an internal session lock.
    // Fire-and-forget the profile creation so setSession can complete.
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        reset();
        return;
      }

      setHasSession(true);
      ensureUserProfile(session)
        .then((profile) => { if (mounted) setUser(profile); })
        .catch(() => {});
    });

    return () => {
      mounted = false;
      linkSub.remove();
      subscription.unsubscribe();
    };
  }, [setUser, setHasSession, setLoading, reset]);
}
