import { Stack, useLocalSearchParams } from 'expo-router';
import { useThemeColors } from '@vacationist/ui';
import { ThemeVarsProvider } from '../../../src/components/ThemeVarsProvider';
import { useTripOfflinePrefetch } from '../../../src/features/trips/hooks/useTripOfflinePrefetch';

export default function TripDetailLayout() {
  const tc = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Warm every tab's data (+ member avatars) into the offline cache while online.
  useTripOfflinePrefetch(id);
  return (
    <Stack
      screenLayout={({ children }) => <ThemeVarsProvider>{children}</ThemeVarsProvider>}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tc.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
