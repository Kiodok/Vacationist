import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { SupportedLocale } from '@vacationist/types';
import { SUPPORTED_LOCALES } from '@vacationist/types';
import { LOCALE_LABELS, LOCALE_BCP47 } from './index';
import i18n from './instance';

export function useLocale() {
  const { i18n: i18nInstance } = useTranslation();
  const locale = i18nInstance.language as SupportedLocale;

  const setLocale = useCallback(
    (newLocale: SupportedLocale) => {
      i18nInstance.changeLanguage(newLocale);
    },
    [i18nInstance],
  );

  return { locale, setLocale, supportedLocales: SUPPORTED_LOCALES, localeLabels: LOCALE_LABELS, localeBCP47: LOCALE_BCP47 };
}

/** Non-hook helper: get current locale from the singleton (use in hook callbacks, toast handlers) */
export function getCurrentLocale(): SupportedLocale {
  return (i18n.language as SupportedLocale) ?? 'en';
}
