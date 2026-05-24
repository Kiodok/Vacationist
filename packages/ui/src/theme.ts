import { useColorScheme } from 'nativewind';

export interface Colors {
  primary: string;
  primaryLight: string;
  primaryMuted: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  danger: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

export type ColorKey = keyof Colors;

export const darkColors: Colors = {
  primary: '#6C63FF',
  primaryLight: '#8A84FF',
  primaryMuted: 'rgba(108, 99, 255, 0.1)',
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  border: '#2E2E2E',
  success: '#3ECF8E',
  successMuted: 'rgba(62, 207, 142, 0.1)',
  warning: '#F5A623',
  warningMuted: 'rgba(245, 166, 35, 0.1)',
  danger: '#FF5C5C',
  textPrimary: '#F2F2F2',
  textSecondary: '#A0A0A0',
  textMuted: '#5C5C5C',
};

export const lightColors: Colors = {
  primary: '#6C63FF',
  primaryLight: '#8A84FF',
  primaryMuted: 'rgba(108, 99, 255, 0.12)',
  background: '#FFFFFF',
  surface: '#F5F5F7',
  surfaceElevated: '#FFFFFF',
  border: '#E5E5E7',
  success: '#3ECF8E',
  successMuted: 'rgba(62, 207, 142, 0.12)',
  warning: '#F5A623',
  warningMuted: 'rgba(245, 166, 35, 0.12)',
  danger: '#FF5C5C',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted: '#A0A0A0',
};

// Default export retains dark colors for backwards-compat
// (static imports that don't need reactivity, e.g. non-component utils)
export const colors = darkColors;

export function useThemeColors(): Colors {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? darkColors : lightColors;
}
