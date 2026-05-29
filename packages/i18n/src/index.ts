import './types'; // side-effect: registers i18next module augmentation
import { getLocales } from 'expo-localization';
import type { SupportedLocale } from '@vacationist/types';
import { SUPPORTED_LOCALES } from '@vacationist/types';
import { MMKV_LOCALE_KEY, setStorageAdapter, applyLocale, type StorageAdapter } from './persist';

export { SUPPORTED_LOCALES } from '@vacationist/types';
export type { SupportedLocale } from '@vacationist/types';
export { LOCALE_LABELS, LOCALE_BCP47 } from './constants';
export { persistLocale, onLocaleChange } from './persist';

/**
 * Must be called at module scope in _layout.tsx before any component renders.
 * Reads MMKV synchronously; falls back to expo-localization on first launch.
 * The storage adapter is passed in so this package has no direct MMKV dependency.
 */
export function initI18n(storage: StorageAdapter): SupportedLocale {
  setStorageAdapter(storage);

  const persisted = storage.getString(MMKV_LOCALE_KEY);
  const persistedIsValid = !!persisted && (SUPPORTED_LOCALES as readonly string[]).includes(persisted);
  const locale: SupportedLocale = persistedIsValid
    ? (persisted as SupportedLocale)
    : detectDeviceLocale();

  // Write whenever the stored value is missing or not a recognized locale —
  // this self-heals corrupted/invalid MMKV entries as well as fresh installs.
  if (!persistedIsValid) storage.set(MMKV_LOCALE_KEY, locale);

  applyLocale(locale);
  return locale;
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

export { default as i18n } from './instance';
export { I18nProvider } from './provider';
export { useLocale, getCurrentLocale } from './useLocale';
