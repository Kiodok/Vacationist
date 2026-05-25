import type { ReactNode } from 'react';
import { View } from 'react-native';
import { vars, useColorScheme } from 'nativewind';

// CSS variable maps matching global.css :root and .dark blocks.
// Provided via VariableContext (React context) so changes propagate through
// StaticContainer/React.memo boundaries and trigger reliable render-phase
// dispatch inside NativeWind's interop() — unlike external observable dispatch
// which is unreliable on Android Fabric (new arch).
const lightVars = vars({
  '--color-background': '255 255 255',
  '--color-surface': '245 245 247',
  '--color-surface-elevated': '255 255 255',
  '--color-border': '229 229 231',
  '--color-text-primary': '26 26 26',
  '--color-text-secondary': '107 107 107',
  '--color-text-muted': '160 160 160',
});

const darkVars = vars({
  '--color-background': '15 15 15',
  '--color-surface': '26 26 26',
  '--color-surface-elevated': '36 36 36',
  '--color-border': '46 46 46',
  '--color-text-primary': '242 242 242',
  '--color-text-secondary': '160 160 160',
  '--color-text-muted': '92 92 92',
});

export function ThemeVarsProvider({ children }: { children: ReactNode }) {
  const { colorScheme } = useColorScheme();
  return (
    <View style={[{ flex: 1 }, colorScheme === 'dark' ? darkVars : lightVars]}>
      {children}
    </View>
  );
}
