import '../global.css';
import * as Sentry from '@sentry/react-native';
import { initSentry } from '../src/utils/sentry';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { checkForUpdate } from '../src/utils/updateChecker';

initSentry();
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
initDayjs();

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
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
        addToast('success', 'You joined the trip!');
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

    function handleDeepLink(event: { url: string }) {
      const parsed = Linking.parse(event.url);
      const token = parsed.queryParams?.token;
      if (typeof token === 'string' && token) {
        redeemInviteToken(token)
          .then((tripId) => {
            addToast('success', 'You joined the trip!');
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
        const parsed = Linking.parse(url);
        const urlToken = parsed.queryParams?.token;
        if (urlToken && urlToken === pendingInviteToken) return;
        handleDeepLink({ url });
      });
    }

    return () => subscription.remove();
  }, [hasSession, isLoading, user, pendingInviteToken, router, addToast]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return <Slot />;
}

function RootLayout() {
  return (
    <GlobalErrorBoundary>
      <QueryProvider>
        <StatusBar style="light" />
        <AuthGate />
        <ToastContainer />
      </QueryProvider>
    </GlobalErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
