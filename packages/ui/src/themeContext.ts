import { createContext, useContext } from 'react';

export type ResolvedTheme = 'dark' | 'light' | 'colorful';

export const ThemeContext = createContext<ResolvedTheme>('dark');

export const ThemeProvider = ThemeContext.Provider;

export function useResolvedTheme(): ResolvedTheme {
  return useContext(ThemeContext);
}
