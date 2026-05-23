export const colors = {
  primary: '#6C63FF',
  primaryLight: '#8A84FF',
  primaryMuted: 'rgba(108, 99, 255, 0.1)',
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  border: '#2E2E2E',
  success: '#3ECF8E',
  warning: '#F5A623',
  danger: '#FF5C5C',
  textPrimary: '#F2F2F2',
  textSecondary: '#A0A0A0',
  textMuted: '#5C5C5C',
} as const;

export type ColorKey = keyof typeof colors;
