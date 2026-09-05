import { useState } from 'react';
import type { Currency } from '@vacationist/types';
import { getCurrencySymbol } from '@vacationist/utils';
import { getLastUsedTransferCurrency, setLastUsedTransferCurrency } from '../utils/lastUsedTransferCurrency';

/**
 * Default currency for a NEW Flight/Rental/Public Transport row: the last currency the user
 * picked in any transfer sheet, falling back to the trip's own currency only if none is stored
 * yet. Never the trip's *live* currency on its own — that's what let changing the trip currency
 * retroactively reinterpret an already-booked flight's price (the reported bug behind item 12).
 */
export function initialTransferCurrency(tripCurrency: string): Currency {
  return (getLastUsedTransferCurrency() ?? tripCurrency) as Currency;
}

/**
 * Shared per-entity currency-picker wiring for the 6 Transfer create/edit sheets (Flight/Rental/
 * Public Transport). Centralized so the fallback chain and last-used persistence can't drift
 * between sheets — see [[project_v1_34_0_batch]] item 12 and its code-review finding.
 */
export function useTransferCurrencyField(selectedCurrency: Currency, setCurrency: (code: Currency) => void) {
  const [pickerVisible, setPickerVisible] = useState(false);

  return {
    currencySymbol: getCurrencySymbol(selectedCurrency),
    pickerVisible,
    openPicker: () => setPickerVisible(true),
    closePicker: () => setPickerVisible(false),
    onSelect: (code: string) => {
      setCurrency(code as Currency);
      setLastUsedTransferCurrency(code);
    },
  };
}
