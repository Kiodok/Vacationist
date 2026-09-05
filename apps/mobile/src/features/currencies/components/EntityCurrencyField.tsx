import { Pressable, Text } from 'react-native';
import type { Currency } from '@vacationist/types';
import { CurrencyPickerSheet } from './CurrencyPickerSheet';

interface EntityCurrencyFieldProps {
  selectedCurrency: Currency;
  pickerVisible: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (code: string) => void;
}

/** Currency-code button + its picker sheet, paired with useTransferCurrencyField or
 * useAccommodationCurrencyField (the component itself has no entity-specific logic — it's shared
 * across both). Renders as a Fragment (the sheet is a Modal, position-independent) so it can sit
 * inline next to a price TextInput in any create/edit sheet. */
export function EntityCurrencyField({ selectedCurrency, pickerVisible, onOpen, onClose, onSelect }: EntityCurrencyFieldProps) {
  return (
    <>
      <Pressable
        onPress={onOpen}
        className="bg-surface border border-border rounded-sm px-md items-center justify-center min-w-[72px]"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Text className="text-body font-semibold text-text-primary">{selectedCurrency}</Text>
      </Pressable>

      <CurrencyPickerSheet
        visible={pickerVisible}
        selectedCode={selectedCurrency}
        onSelect={onSelect}
        onClose={onClose}
      />
    </>
  );
}
