import '../global.css';
import * as Sentry from '@sentry/react-native';
import { initSentry } from '../src/utils/sentry';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Appearance, AppState, Platform, useColorScheme as useRNColorScheme } from 'react-native';
import { useColorScheme as useNWColorScheme } from 'nativewind';
import { checkForUpdate } from '../src/utils/updateChecker';
import { initI18n, I18nProvider, i18n, LOCALE_BCP47, onLocaleChange } from '@vacationist/i18n';
import { setDayjsLocale, setDefaultFormatLocale } from '@vacationist/utils';
import { storage } from '../src/utils/mmkvStorage';

initSentry();
import { Slot, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { initDayjs } from '@vacationist/utils';
import { redeemInviteToken } from '@vacationist/api';
import { GlobalErrorBoundary } from '../src/components/GlobalErrorBoundary';
import { QueryProvider } from '../src/providers/QueryProvider';
import { ToastContainer } from '../src/components/Toast';
import { useAuthInit } from '../src/features/auth/hooks/useAuthInit';
import { useAuthStore } from '../src/stores/authStore';
import { useToastStore } from '../src/stores/toastStore';
import { registerForPushNotificationsAsync } from '../src/features/notifications/utils/registerForPushNotifications';
import { usePushNotificationHandler } from '../src/features/notifications/hooks/usePushNotificationHandler';
import { NetworkProvider } from '../src/providers/NetworkProvider';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { useThemeStore } from '../src/stores/themeStore';
import { colorScheme as cssColorScheme } from 'react-native-css-interop';
import { syncSystemColorScheme } from '../src/utils/themeSync';
import VercelWebTools from '../src/components/VercelWebTools';
import { ForceUpdateGate } from '../src/components/ForceUpdateGate';
import { colors, ThemeProvider, setLiveColors } from '@vacationist/ui';
import type { ResolvedTheme } from '@vacationist/ui';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Create the Android notification channel at module load — before any auth or
// notification could arrive. Android auto-creates missing channels with
// IMPORTANCE_DEFAULT (no heads-up banners) if the channel doesn't exist when the
// first FCM message lands. Once a channel is created with lower importance, the
// app cannot upgrade it programmatically. Creating it here guarantees MAX
// importance is set before anything else runs.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default-v2', {
    name: 'Vacationist',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: colors.primary,
    showBadge: true,
    enableVibrate: true,
  }).catch(() => {});
}

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
// Keep dayjs and formatCurrency in sync on every locale change (initI18n + persistLocale).
onLocaleChange((loc) => {
  setDayjsLocale(loc);
  setDefaultFormatLocale(LOCALE_BCP47[loc] ?? 'en-US');
});
initI18n(storage); // fires the callback above with the startup locale
initDayjs();

// Synchronously prime the NativeWind color-scheme observable before the first
// render so components mount with the correct CSS variables already resolved.
const _pt = useThemeStore.getState().theme;
const _is: 'light' | 'dark' =
  _pt === 'system'
    ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light')
    : _pt === 'colorful'
      ? 'light'
      : _pt;
syncSystemColorScheme(_is);
if (Platform.OS !== 'web' || typeof window !== 'undefined') {
  cssColorScheme.set(_is);
}

// Initialize the live-colors singleton before any component renders so that
// static `colors.*` imports (icon color props etc.) reflect the stored theme.
const _initResolved: ResolvedTheme = _pt === 'colorful' ? 'colorful' : _is;
setLiveColors(_initResolved);

// Keep live colors in sync with subsequent theme changes.
// Zustand subscriptions fire synchronously before React schedules re-renders,
// so _liveColors is always up-to-date when components read colors.* in render.
useThemeStore.subscribe((state) => {
  const t = state.theme;
  const rnScheme = Appearance.getColorScheme() ?? 'light';
  const resolved: ResolvedTheme =
    t === 'colorful' ? 'colorful' :
    t === 'system' ? (rnScheme === 'dark' ? 'dark' : 'light') :
    t as 'dark' | 'light';
  setLiveColors(resolved);
});

function AuthGate() {
  // Keeps AuthGate subscribed to systemColorScheme changes via useState (reliable on
  // all architectures). Re-renders update systemColorScheme, which ThemeVarsProvider
  // in the tab layout reads via useNWColorScheme() to push new CSS variables.
  useNWColorScheme();
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    'Nunito-Regular': require('../assets/fonts/Nunito-Regular.ttf'),
    'Nunito-SemiBold': require('../assets/fonts/Nunito-SemiBold.ttf'),
    'Nunito-Bold': require('../assets/fonts/Nunito-Bold.ttf'),
  });
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const hasSession = useAuthStore((s) => s.hasSession);
  const isLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const pendingInviteToken = useAuthStore((s) => s.pendingInviteToken);
  const setPendingInviteToken = useAuthStore((s) => s.setPendingInviteToken);
  const setPushToken = useAuthStore((s) => s.setPushToken);
  const addToast = useToastStore((s) => s.addToast);
  const userId = user?.id;

  useAuthInit();
  usePushNotificationHandler();

  const appState = useRef(AppState.currentState);
  const initialUrlHandled = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        checkForUpdate();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // Record every screen transition as a Sentry breadcrumb for crash context.
  useEffect(() => {
    if (pathname) {
      Sentry.addBreadcrumb({ category: 'navigation', message: pathname, level: 'info' });
    }
  }, [pathname]);

  // Register for push notifications once per user session
  useEffect(() => {
    if (!hasSession || !userId) return;

    registerForPushNotificationsAsync().then((token) => {
      setPushToken(token);
    });
  }, [hasSession, userId, setPushToken]);

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';

    if (!hasSession && !inAuth) {
      router.replace('/(auth)/login');
    } else if (hasSession && inAuth) {
      router.replace('/(tabs)');
    }
  }, [hasSession, isLoading, segments, router]);

  // Process invite token saved before OAuth redirect (Zustand or sessionStorage).
  // Waits for `user` to be set — the profile must exist before the RLS-gated
  // redeem_invite_token RPC can insert into trip_members.
  useEffect(() => {
    if (!hasSession || isLoading || !user) return;

    let token = pendingInviteToken;
    if (!token && Platform.OS === 'web') {
      try { token = sessionStorage.getItem('pendingInviteToken'); } catch {}
    }
    if (!token) return;

    setPendingInviteToken(null);
    if (Platform.OS === 'web') {
      try { sessionStorage.removeItem('pendingInviteToken'); } catch {}
    }

    redeemInviteToken(token)
      .then((tripId) => {
        addToast('success', i18n.t('auth:invite.joined'));
        router.push({ pathname: '/trip/[id]', params: { id: tripId } } as never);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Invalid invite link';
        addToast('error', message);
      });
  }, [hasSession, isLoading, user, pendingInviteToken, setPendingInviteToken, router, addToast]);

  // Handle invite deep links when user is already authenticated.
  // Guards on `user` so redeemInviteToken is never called before the profile
  // row exists — new accounts need ensureUserProfile to complete first.
  useEffect(() => {
    if (!hasSession || isLoading || !user) return;

    function extractInviteToken(url: string): string | null {
      try {
        // Handle both vacationist://join?token=... and https://vacationist.app/join?token=...
        const parsed = Linking.parse(url);
        const token = parsed.queryParams?.token;
        return typeof token === 'string' && token ? token : null;
      } catch {
        return null;
      }
    }

    function handleDeepLink(event: { url: string }) {
      const token = extractInviteToken(event.url);
      if (token) {
        redeemInviteToken(token)
          .then((tripId) => {
            addToast('success', i18n.t('auth:invite.joined'));
            router.push({ pathname: '/trip/[id]', params: { id: tripId } } as never);
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : 'Invalid invite link';
            addToast('error', message);
          });
      }
    }

    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Process the launch URL only once. Skip if the token is already being
    // handled by the pendingInviteToken effect (join → sign-in flow), which
    // prevents double-redemption for new accounts arriving via an invite link.
    if (!initialUrlHandled.current) {
      initialUrlHandled.current = true;
      Linking.getInitialURL().then((url) => {
        if (!url) return;
        const urlToken = extractInviteToken(url);
        if (urlToken && urlToken === pendingInviteToken) return;
        handleDeepLink({ url });
      });
    }

    return () => subscription.remove();
  }, [hasSession, isLoading, user, pendingInviteToken, router, addToast]);

  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded]);

  return <Slot />;
}

function ThemeController() {
  const theme = useThemeStore((s) => s.theme);
  // React Native's own hook — reliably updates when OS theme changes (used for 'system' mode)
  const rnScheme = useRNColorScheme();
  const effective: 'light' | 'dark' =
    theme === 'system'
      ? (rnScheme === 'dark' ? 'dark' : 'light')
      : theme === 'colorful'
        ? 'light'
        : theme;

  // useLayoutEffect fires synchronously before the browser paints and — critically —
  // before MutationObserver microtasks flush. This ensures .dark/.colorful is on <html> and
  // the css-interop observable is set to the stored preference before the
  // NativeWind stylesheet injection triggers the MutationObserver, which would
  // otherwise reset the scheme to the system preference on every page load.
  useLayoutEffect(() => {
    syncSystemColorScheme(effective);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', effective === 'dark');
      document.documentElement.classList.toggle('colorful', theme === 'colorful');
      document.documentElement.style.backgroundColor =
        theme === 'colorful' ? '#FDA444' : effective === 'dark' ? '#0F0F0F' : '#FFFFFF';
    }
    if (Platform.OS !== 'web' || typeof window !== 'undefined') {
      cssColorScheme.set(effective);
    }
  }, [effective, theme]);

  // css-interop's own AppState listener resets systemColorScheme to
  // Appearance.getColorScheme() every time the app comes to foreground.
  // Our listener is registered after css-interop's (component mount happens
  // after module load), so we fire second and reliably override the reset.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        syncSystemColorScheme(effective);
        if (Platform.OS !== 'web' || typeof window !== 'undefined') {
          cssColorScheme.set(effective);
        }
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          document.documentElement.classList.toggle('colorful', theme === 'colorful');
        }
      }
    });
    return () => sub.remove();
  }, [effective, theme]);

  // 'light' = light-coloured icons (for dark backgrounds); 'dark' = dark icons (for light).
  return <StatusBar style={effective === 'dark' ? 'light' : 'dark'} />;
}

function RootLayoutInner() {
  const theme = useThemeStore((s) => s.theme);
  const rnScheme = useRNColorScheme();
  const resolvedTheme: ResolvedTheme =
    theme === 'colorful'
      ? 'colorful'
      : theme === 'system'
        ? (rnScheme === 'dark' ? 'dark' : 'light')
        : theme;

  return (
    <ThemeProvider value={resolvedTheme}>
      <ThemeController />
      <OfflineBanner />
      <ForceUpdateGate />
      <AuthGate />
      <ToastContainer />
      <VercelWebTools />
    </ThemeProvider>
  );
}

function RootLayout() {
  return (
    <GlobalErrorBoundary>
      <I18nProvider>
        <NetworkProvider>
          <QueryProvider>
            <RootLayoutInner />
          </QueryProvider>
        </NetworkProvider>
      </I18nProvider>
    </GlobalErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
