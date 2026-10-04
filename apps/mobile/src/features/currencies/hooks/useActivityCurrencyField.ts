import { useState } from 'react';
import type { Currency } from '@vacationist/types';
import { getCurrencySymbol } from '@vacationist/utils';
import { getLastUsedActivityCurrency, setLastUsedActivityCurrency } from '../utils/lastUsedActivityCurrency';

/**
 * Default currency for a NEW Activity row: the last currency the user picked in any activity
 * sheet, falling back to the trip's own currency only if none is stored yet. Never the trip's
 * *live* currency on its own — see useTransferCurrencyField.ts's identical reasoning for the
 * same bug class (item 12).
 */
export function initialActivityCurrency(tripCurrency: string): Currency {
  return (getLastUsedActivityCurrency() ?? tripCurrency) as Currency;
}

/**
 * Shared per-entity currency-picker wiring for the Activity create/edit sheets — sibling of
 * useAccommodationCurrencyField.ts, kept as its own small hook (rather than a parametrized shared
 * one) to match this repo's existing "one small hook + storage util per entity family"
 * convention.
 */
export function useActivityCurrencyField(selectedCurrency: Currency, setCurrency: (code: Currency) => void) {
  const [pickerVisible, setPickerVisible] = useState(false);

  return {
    currencySymbol: getCurrencySymbol(selectedCurrency),
    pickerVisible,
    openPicker: () => setPickerVisible(true),
    closePicker: () => setPickerVisible(false),
    onSelect: (code: string) => {
      setCurrency(code as Currency);
      setLastUsedActivityCurrency(code);
    },
  };
}
