import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import {
  getSession,
  ensureUserProfile,
  onAuthStateChange,
  setSessionFromUrl,
  readStoredSession,
} from '@vacationist/api';
import type { User } from '@vacationist/types';
import { useAuthStore } from '../../../stores/authStore';
import { saveUserToCache, loadUserFromCache, clearUserCache } from '../../../utils/userCache';
import { getInitialOnlineStatus } from '../../../hooks/netInfoUtils';
import { persistLocale, SUPPORTED_LOCALES } from '@vacationist/i18n';
import { setSentryUser, clearSentryUser } from '../../../utils/sentry';
import type { SupportedLocale } from '@vacationist/types';
import { maybeTrackSignUp } from '../../consent/utils/trackSignUp';
import { attemptRestoreSignIn, ensureRestoreKey } from '../utils/restoreCredential';
import { markVerified, offlineWindowState, clearAuthSnapshot } from '../utils/authSnapshot';

/**
 * A stand-in User for the rare case of a restored SecureStore session with no
 * cached profile while offline (fresh install from a device backup, then no
 * signal). Lets the app open instead of dead-ending on the network-only login
 * screen; the real profile replaces it the moment `ensureUserProfile` succeeds.
 */
function minimalUser(id: string): User {
  return {
    id,
    name: '',
    email: null,
    avatar_url: null,
    locale: null,
    timezone: 'UTC',
    is_guest: false,
    preferred_currency: null,
    show_store_badges: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

export function useAuthInit() {
  const setUser = useAuthStore((s) => s.setUser);
  const setHasSession = useAuthStore((s) => s.setHasSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setOfflineReauthRequired = useAuthStore((s) => s.setOfflineReauthRequired);
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

    // Confirms the session against the server and refreshes the profile, off the
    // splash critical path. Never signs the user out on a network failure — it
    // falls back to the offline trust window instead (Phase 19).
    async function verifyInBackground() {
      try {
        const session = await getSession();
        if (!session) {
          // "Online" per NetInfo but the token refresh still failed (captive
          // portal, flaky Wi-Fi). Don't sign out — respect the trust window.
          const state = await offlineWindowState();
          if (!mounted) return;
          if (state === 'no-credentials') {
            clearSentryUser();
            reset();
          } else if (state === 'needs-extend') {
            setOfflineReauthRequired(true);
          }
          return;
        }

        const profile = await ensureUserProfile(session);
        if (!mounted) return;
        setUser(profile);
        saveUserToCache(profile);
        setSentryUser(profile.id, profile.locale);
        await markVerified(profile.id);
        maybeTrackSignUp(profile);
        void ensureRestoreKey(profile);
        if (profile.locale && (SUPPORTED_LOCALES as readonly string[]).includes(profile.locale)) {
          persistLocale(profile.locale as SupportedLocale);
        }
      } catch {
        // Network blip mid-verify — cached data is already on screen; leave it.
      }
    }

    async function loadSession() {
      try {
        const stored = await readStoredSession();
        const cached = loadUserFromCache();

        if (!stored) {
          // No credentials on disk. Show the login screen now, but still try a
          // silent Android Zero-Tap restore in the background — onAuthStateChange
          // swaps to the app if it lands. (No-ops fast on iOS/web.)
          if (mounted) {
            reset();
            setLoading(false);
          }
          void attemptRestoreSignIn();
          return;
        }

        const online = await getInitialOnlineStatus().catch(() => true);

        if (!online) {
          const state = await offlineWindowState();
          if (!mounted) return;
          if (state === 'no-credentials') {
            reset();
            setLoading(false);
            return;
          }
          if (state === 'needs-extend') {
            setOfflineReauthRequired(true);
            setLoading(false);
            return;
          }
          // 'valid' — trust the stored session and open the app from cache.
          setHasSession(true);
          const offlineUser = cached ?? minimalUser(stored.userId);
          setUser(offlineUser);
          if (cached) setSentryUser(cached.id, cached.locale);
          if (cached?.locale && (SUPPORTED_LOCALES as readonly string[]).includes(cached.locale)) {
            persistLocale(cached.locale as SupportedLocale);
          }
          setLoading(false);
          return;
        }

        // Online with credentials: open from cache immediately, verify after.
        if (mounted) {
          setHasSession(true);
          if (cached) {
            setUser(cached);
            setSentryUser(cached.id, cached.locale);
            if ((SUPPORTED_LOCALES as readonly string[]).includes(cached.locale ?? '')) {
              persistLocale(cached.locale as SupportedLocale);
            }
          }
          setLoading(false);
        }
        void verifyInBackground();
      } catch {
        if (mounted) {
          clearSentryUser();
          reset();
        }
      } finally {
        // Branches above already clear loading; this covers a thrown error.
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
        // Supabase surfaces BOTH an explicit sign-out and a transient offline
        // token-refresh failure as SIGNED_OUT. Only treat it as real when there
        // is genuinely nothing left on disk — a retryable failure keeps the
        // session blob, and the auto-refresh ticker heals it on reconnect.
        // NEVER clear the user cache here on a transient failure: it's the
        // offline fallback (Phase 19 — this used to wipe it).
        readStoredSession().then((localSession) => {
          if (!localSession && mounted) {
            clearUserCache();
            clearSentryUser();
            void clearAuthSnapshot();
            reset();
          }
        }).catch(() => {
          // A failed storage read is not proof of sign-out — leave state intact.
        });
        return;
      }

      setHasSession(true);
      setOfflineReauthRequired(false);
      ensureUserProfile(session)
        .then((profile) => {
          if (mounted) {
            setUser(profile);
            saveUserToCache(profile);
            setSentryUser(profile.id, profile.locale);
            void markVerified(profile.id);
            maybeTrackSignUp(profile);
            void ensureRestoreKey(profile);
            if (profile.locale && (SUPPORTED_LOCALES as readonly string[]).includes(profile.locale)) {
              persistLocale(profile.locale as SupportedLocale);
            }
          }
        })
        .catch(() => {
          // Profile fetch failed — nothing actionable here besides leaving state as-is.
        });
    });

    return () => {
      mounted = false;
      linkSub.remove();
      subscription.unsubscribe();
    };
  }, [setUser, setHasSession, setLoading, setOfflineReauthRequired, reset]);
}
