import type { SupportedLocale } from '@vacationist/types';
import i18n from './instance';

export const MMKV_LOCALE_KEY = 'locale_preference';

export type StorageAdapter = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
};

let _storage: StorageAdapter | null = null;
let _onLocaleChange: ((locale: SupportedLocale) => void) | null = null;

export function setStorageAdapter(s: StorageAdapter): void {
  _storage = s;
}

export function onLocaleChange(cb: (locale: SupportedLocale) => void): void {
  _onLocaleChange = cb;
}

export function applyLocale(locale: SupportedLocale): void {
  i18n.changeLanguage(locale);
  _onLocaleChange?.(locale);
}

export function persistLocale(
  locale: SupportedLocale,
  storage?: { set: (key: string, value: string) => void },
): void {
  const s = storage ?? _storage;
  if (s) s.set(MMKV_LOCALE_KEY, locale);
  applyLocale(locale);
}
