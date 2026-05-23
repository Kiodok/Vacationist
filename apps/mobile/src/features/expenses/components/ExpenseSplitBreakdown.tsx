import { View, Text, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Expense, ExpenseSplit, User, Currency } from '@vacationist/types';
import { formatCurrency } from '@vacationist/utils';
import { colors } from '@vacationist/ui';

interface ExpenseSplitBreakdownProps {
  visible: boolean;
  onClose: () => void;
  expense: Expense;
  splits: ExpenseSplit[];
  members: Map<string, User>;
  currentUserId: string | undefined;
  currency: Currency;
  onSettle: (splitId: string) => void;
  onUnsettle: (splitId: string) => void;
  canManage: boolean;
}

export function ExpenseSplitBreakdown({
  visible,
  onClose,
  expense,
  splits,
  members,
  currentUserId,
  currency,
  onSettle,
  onUnsettle,
  canManage,
}: ExpenseSplitBreakdownProps) {
  const payer = members.get(expense.paid_by);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-background/80"
          onPress={onClose}
        />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl">
          {/* Handle bar */}
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <Text className="text-heading-m text-text-primary mb-xs">{expense.title}</Text>
          <Text className="text-body-small text-text-secondary mb-md">
            {formatCurrency(Number(expense.amount), currency)} paid by {payer?.name ?? 'Unknown'}
          </Text>

          <View className="gap-sm">
            {splits
              .filter((s) => s.user_id !== expense.paid_by)
              .map((split) => {
              const user = members.get(split.user_id);
              const isSettled = split.status === 'settled';
              const canToggle =
                canManage ||
                currentUserId === expense.paid_by ||
                currentUserId === split.user_id;

              return (
                <View key={split.id} className="flex-row items-center justify-between py-sm">
                  <View className="flex-row items-center gap-sm flex-1">
                    <View className={`w-[32px] h-[32px] rounded-full items-center justify-center ${isSettled ? 'bg-success/20' : 'bg-surface'}`}>
                      <Ionicons
                        name={isSettled ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={isSettled ? colors.success : colors.textMuted}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-body text-text-primary" numberOfLines={1}>
                        {user?.name ?? 'Unknown'}
                      </Text>
                      <Text className={`text-body-small ${isSettled ? 'text-success' : 'text-text-secondary'}`}>
                        {formatCurrency(Number(split.amount_owed), currency)}
                        {isSettled ? ' · Settled' : ' · Open'}
                      </Text>
                    </View>
                  </View>

                  {canToggle && (
                    <Pressable
                      onPress={() => isSettled ? onUnsettle(split.id) : onSettle(split.id)}
                      className={`px-md py-sm rounded-sm ${isSettled ? 'bg-surface border border-border' : 'bg-success/10'}`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text className={`text-body-small font-medium ${isSettled ? 'text-text-secondary' : 'text-success'}`}>
                        {isSettled ? 'Reopen' : 'Settle'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          <View className="border-t border-border pt-sm mt-md">
            <Text className="text-text-secondary text-body-small text-center">
              {splits.filter((s) => s.user_id !== expense.paid_by && s.status === 'settled').length} of {splits.filter((s) => s.user_id !== expense.paid_by).length} settled
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
