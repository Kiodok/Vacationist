import { useEffect } from 'react';
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

    async function handleDeepLink(url: string | null) {
      if (!url || !mounted) return;
      if (url.includes('access_token') || url.includes('refresh_token')) {
        try {
          await setSessionFromUrl(url);
        } catch {
          // Token extraction failed — auth state listener will handle cleanup
        }
      }
    }

    loadSession();

    Linking.getInitialURL().then(handleDeepLink);
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        reset();
        return;
      }

      setHasSession(true);
      try {
        const profile = await ensureUserProfile(session);
        if (mounted) setUser(profile);
      } catch {
        // Profile ensure failed — will retry on next auth state change
      }
    });

    return () => {
      mounted = false;
      linkSub.remove();
      subscription.unsubscribe();
    };
  }, [setUser, setHasSession, setLoading, reset]);
}
