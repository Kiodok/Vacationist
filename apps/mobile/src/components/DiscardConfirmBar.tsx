import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

interface DiscardConfirmBarProps {
  onCancel: () => void;
  onDiscard: () => void;
  /** Overrides the default `common.confirm.discardChanges` copy — e.g. the Expense sheets keep
   * their existing, already-reviewed expense-specific wording. */
  message?: string;
}

/**
 * Inline "Discard changes?" bar shown in place of a sheet's body while `useDiscardGuard`'s
 * `discardConfirmVisible` is true. Markup lifted verbatim from CreateExpenseSheet.tsx, which
 * shipped and was reviewed in v1.39.6 — kept pixel-identical across all four themes.
 */
export function DiscardConfirmBar({ onCancel, onDiscard, message }: DiscardConfirmBarProps) {
  const { t } = useTranslation('common');
  return (
    <View className="rounded-md border border-danger p-md gap-sm mb-md">
      <Text className="text-body-small text-text-secondary text-center">
        {message ?? t('confirm.discardChanges')}
      </Text>
      <View className="flex-row gap-sm">
        <Pressable
          onPress={onCancel}
          className="flex-1 min-h-[44px] rounded-md border border-border items-center justify-center"
        >
          <Text className="text-body text-text-secondary">{t('button.cancel')}</Text>
        </Pressable>
        <Pressable
          onPress={onDiscard}
          className="flex-1 min-h-[44px] rounded-md bg-danger items-center justify-center"
        >
          <Text className="text-body text-white font-semibold">{t('confirm.discardYes')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
