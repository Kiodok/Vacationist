import './types'; // side-effect: registers i18next module augmentation
import i18n from './instance';
import { getLocales } from 'expo-localization';
import type { SupportedLocale } from '@vacationist/types';
import { SUPPORTED_LOCALES } from '@vacationist/types';

export { SUPPORTED_LOCALES } from '@vacationist/types';
export type { SupportedLocale } from '@vacationist/types';

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  de: 'Deutsch',
};

export const LOCALE_BCP47: Record<SupportedLocale, string> = {
  en: 'en-US',
  de: 'de-DE',
};

const MMKV_LOCALE_KEY = 'locale_preference';

function detectDeviceLocale(): SupportedLocale {
  try {
    const locales = getLocales();
    const tag = locales[0]?.languageTag ?? '';
    const lang = tag.split('-')[0]?.toLowerCase() ?? '';
    if ((SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
      return lang as SupportedLocale;
    }
  } catch {}
  return 'de';
}

/**
 * Must be called at module scope in _layout.tsx before any component renders.
 * Reads MMKV synchronously; falls back to expo-localization on first launch.
 * The storage adapter is passed in so this package has no direct MMKV dependency.
 */
export function initI18n(storage: { getString: (key: string) => string | undefined; set: (key: string, value: string) => void }): SupportedLocale {
  let locale: SupportedLocale;

  const persisted = storage.getString(MMKV_LOCALE_KEY);
  if (persisted && (SUPPORTED_LOCALES as readonly string[]).includes(persisted)) {
    locale = persisted as SupportedLocale;
  } else {
    locale = detectDeviceLocale();
    storage.set(MMKV_LOCALE_KEY, locale);
  }

  i18n.changeLanguage(locale);
  return locale;
}

/**
 * Persist a locale change to MMKV and update i18next.
 * Call this from the language switcher, passing the app's storage instance.
 */
export function persistLocale(
  locale: SupportedLocale,
  storage: { set: (key: string, value: string) => void },
): void {
  storage.set(MMKV_LOCALE_KEY, locale);
  i18n.changeLanguage(locale);
}

export { default as i18n } from './instance';
export { I18nProvider } from './provider';
export { useLocale, getCurrentLocale } from './useLocale';
