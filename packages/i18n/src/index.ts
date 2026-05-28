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

type StorageAdapter = { getString: (key: string) => string | undefined; set: (key: string, value: string) => void };
// Captured by initI18n so callers don't need to thread storage through every call.
let _storage: StorageAdapter | null = null;
// Single app-level callback invoked on every locale change (covers initI18n + persistLocale).
// Registered by _layout.tsx to keep dayjs and formatCurrency in sync.
let _onLocaleChange: ((locale: SupportedLocale) => void) | null = null;

export function onLocaleChange(cb: (locale: SupportedLocale) => void): void {
  _onLocaleChange = cb;
}

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
export function initI18n(storage: StorageAdapter): SupportedLocale {
  _storage = storage;

  const persisted = storage.getString(MMKV_LOCALE_KEY);
  const persistedIsValid = !!persisted && (SUPPORTED_LOCALES as readonly string[]).includes(persisted);
  const locale: SupportedLocale = persistedIsValid
    ? persisted as SupportedLocale
    : detectDeviceLocale();

  // Write whenever the stored value is missing or not a recognized locale —
  // this self-heals corrupted/invalid MMKV entries as well as fresh installs.
  if (!persistedIsValid) storage.set(MMKV_LOCALE_KEY, locale);

  // Apply to i18next and fire the registered callback (updates dayjs, formatCurrency, etc.)
  _applyLocale(locale);
  return locale;
}

/**
 * Persist a locale change to MMKV and update i18next.
 * Call this from the language switcher, passing the app's storage instance.
 */
export function persistLocale(
  locale: SupportedLocale,
  storage?: { set: (key: string, value: string) => void },
): void {
  const s = storage ?? _storage;
  if (s) s.set(MMKV_LOCALE_KEY, locale);
  _applyLocale(locale);
}

function _applyLocale(locale: SupportedLocale): void {
  i18n.changeLanguage(locale);
  _onLocaleChange?.(locale);
}

export { default as i18n } from './instance';
export { I18nProvider } from './provider';
export { useLocale, getCurrentLocale } from './useLocale';
