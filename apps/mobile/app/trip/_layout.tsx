import { Stack } from 'expo-router';
import { useThemeColors } from '@vacationist/ui';
import { ThemeVarsProvider } from '../../src/components/ThemeVarsProvider';

export default function TripLayout() {
  const tc = useThemeColors();
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
