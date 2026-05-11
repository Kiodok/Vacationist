import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { initDayjs } from '@vacationist/utils';
import { GlobalErrorBoundary } from '../src/components/GlobalErrorBoundary';
import { QueryProvider } from '../src/providers/QueryProvider';
import { ToastContainer } from '../src/components/Toast';
import { useAuthInit } from '../src/features/auth/hooks/useAuthInit';
import { useAuthStore } from '../src/stores/authStore';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
initDayjs();

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const hasSession = useAuthStore((s) => s.hasSession);
  const isLoading = useAuthStore((s) => s.isLoading);

  useAuthInit();

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';

    if (!hasSession && !inAuth) {
      router.replace('/(auth)/login');
    } else if (hasSession && inAuth) {
      router.replace('/(tabs)');
    }
  }, [hasSession, isLoading, segments, router]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return <Slot />;
}

export default function RootLayout() {
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
