import { useState } from 'react';
import type { Currency } from '@vacationist/types';
import { getCurrencySymbol } from '@vacationist/utils';
import { getLastUsedAccommodationCurrency, setLastUsedAccommodationCurrency } from '../utils/lastUsedAccommodationCurrency';

/**
 * Default currency for a NEW Accommodation row: the last currency the user picked in any
 * accommodation sheet, falling back to the trip's own currency only if none is stored yet. Never
 * the trip's *live* currency on its own — see useTransferCurrencyField.ts's identical reasoning
 * for the same bug class (item 12).
 */
export function initialAccommodationCurrency(tripCurrency: string): Currency {
  return (getLastUsedAccommodationCurrency() ?? tripCurrency) as Currency;
}

/**
 * Shared per-entity currency-picker wiring for the Accommodation create/edit sheets — sibling of
 * useTransferCurrencyField.ts, kept as its own small hook (rather than a parametrized shared one)
 * to match this repo's existing "one small hook + storage util per entity family" convention
 * (lastUsedCurrency.ts vs. lastUsedTransferCurrency.ts).
 */
export function useAccommodationCurrencyField(selectedCurrency: Currency, setCurrency: (code: Currency) => void) {
  const [pickerVisible, setPickerVisible] = useState(false);

  return {
    currencySymbol: getCurrencySymbol(selectedCurrency),
    pickerVisible,
    openPicker: () => setPickerVisible(true),
    closePicker: () => setPickerVisible(false),
    onSelect: (code: string) => {
      setCurrency(code as Currency);
      setLastUsedAccommodationCurrency(code);
    },
  };
}
