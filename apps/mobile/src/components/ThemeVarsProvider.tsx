import type { ReactNode } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import { useResolvedTheme } from '@vacationist/ui';

// CSS variable maps matching global.css :root, .dark, and .colorful blocks.
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
  '--font-family-base': 'System',
  '--color-primary': '108 99 255',
  '--color-primary-light': '138 132 255',
  '--color-success': '62 207 142',
  '--color-warning': '245 166 35',
  '--color-danger': '255 92 92',
});

const darkVars = vars({
  '--color-background': '15 15 15',
  '--color-surface': '26 26 26',
  '--color-surface-elevated': '36 36 36',
  '--color-border': '46 46 46',
  '--color-text-primary': '242 242 242',
  '--color-text-secondary': '160 160 160',
  '--color-text-muted': '92 92 92',
  '--font-family-base': 'System',
  '--color-primary': '108 99 255',
  '--color-primary-light': '138 132 255',
  '--color-success': '62 207 142',
  '--color-warning': '245 166 35',
  '--color-danger': '255 92 92',
});

const colorfulVars = vars({
  '--color-background': '253 164 68',
  '--color-surface': '254 206 138',
  '--color-surface-elevated': '254 224 173',
  '--color-border': '224 138 37',
  '--color-text-primary': '105 15 12',
  '--color-text-secondary': '122 36 24',
  '--color-text-muted': '139 104 64',
  '--font-family-base': 'Nunito-Regular',
  '--color-primary': '140 97 150',
  '--color-primary-light': '164 122 176',
  '--color-success': '0 130 77',
  '--color-warning': '155 61 0',
  '--color-danger': '184 50 50',
});

export function ThemeVarsProvider({ children }: { children: ReactNode }) {
  const theme = useResolvedTheme();
  const activeVars = theme === 'colorful' ? colorfulVars : theme === 'dark' ? darkVars : lightVars;
  return (
    <View style={[{ flex: 1 }, activeVars]}>
      {children}
    </View>
  );
}
