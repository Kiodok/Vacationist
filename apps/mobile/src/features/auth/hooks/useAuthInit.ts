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
import { saveUserToCache, loadUserFromCache, clearUserCache } from '../../../utils/userCache';
import { persistLocale, SUPPORTED_LOCALES } from '@vacationist/i18n';
import { setSentryUser, clearSentryUser } from '../../../utils/sentry';
import type { SupportedLocale } from '@vacationist/types';

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
      if (href.includes('access_token') || href.includes('refresh_token') || href.includes('code=')) {
        webAuthUrl = href;
        // Strip auth params from the visible URL — remove hash (implicit) and code param (PKCE)
        const cleanUrl = new URL(href);
        cleanUrl.searchParams.delete('code');
        window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search);
      }
    }

    async function loadSession() {
      try {
        const session = await getSession();
        if (!mounted) return;

        if (!session) {
          // No local session — must sign in
          reset();
          return;
        }

        // Restore immediately from cache so the app is usable offline
        setHasSession(true);
        const cached = loadUserFromCache();
        if (cached && mounted) setUser(cached);

        try {
          // Fetch fresh profile; updates the cache on success
          const profile = await ensureUserProfile(session);
          if (mounted) {
            setUser(profile);
            saveUserToCache(profile);
            setSentryUser(profile.id, profile.locale);
            // Sync all locale singletons from the server-saved preference.
            // Only fires when profile.locale is non-null (null = new user, use device locale).
            // persistLocale propagates to dayjs + formatCurrency via the registered callback.
            if (profile.locale && (SUPPORTED_LOCALES as readonly string[]).includes(profile.locale)) {
              persistLocale(profile.locale as SupportedLocale);
            }
          }
        } catch {
          // Network unavailable — cached profile already set above.
          // Only sign the user out if we have NO cached profile
          // (first install with no prior successful sign-in).
          if (!cached && mounted) { clearSentryUser(); reset(); }
        }
      } catch {
        // getSession() itself failed (shouldn't happen — reads local storage)
        if (mounted) { clearSentryUser(); reset(); }
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
          if (url.includes('access_token') || url.includes('refresh_token') || url.includes('code=')) {
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
      if (url.includes('access_token') || url.includes('refresh_token') || url.includes('code=')) {
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
        // Only clear state on an explicit sign-out, not a transient token
        // refresh failure (which Supabase also surfaces as SIGNED_OUT).
        // We distinguish by checking whether we still have a locally
        // stored session: getSession() reads SecureStore synchronously.
        getSession().then((localSession) => {
          if (!localSession && mounted) {
            clearUserCache();
            clearSentryUser();
            reset();
          }
        }).catch(() => {
          if (mounted) {
            clearUserCache();
            clearSentryUser();
            reset();
          }
        });
        return;
      }

      setHasSession(true);
      ensureUserProfile(session)
        .then((profile) => {
          if (mounted) {
            setUser(profile);
            saveUserToCache(profile);
            setSentryUser(profile.id, profile.locale);
            if (profile.locale && (SUPPORTED_LOCALES as readonly string[]).includes(profile.locale)) {
              persistLocale(profile.locale as SupportedLocale);
            }
          }
        })
        .catch(() => {});
    });

    return () => {
      mounted = false;
      linkSub.remove();
      subscription.unsubscribe();
    };
  }, [setUser, setHasSession, setLoading, reset]);
}
