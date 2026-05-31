import { View, Text, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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
  onCover: (splitId: string) => void;
  onUncover: (splitId: string) => void;
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
  onCover,
  onUncover,
  canManage,
}: ExpenseSplitBreakdownProps) {
  const { t } = useTranslation('expenses');
  const payer = members.get(expense.paid_by);

  // Non-payer splits only (for cover expenses, paid_by = covered person)
  const owerSplits = splits.filter((s) => s.user_id !== expense.paid_by);

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
            {expense.split_method === 'cover'
              ? t('card.coveredFor', { name: payer?.name ?? 'Unknown' })
              : t('split.paidBy', { amount: formatCurrency(Number(expense.amount), currency), name: payer?.name ?? 'Unknown' })}
          </Text>

          <View className="gap-sm">
            {owerSplits.map((split) => {
              const user = members.get(split.user_id);
              const coveredByUser = split.covered_by ? members.get(split.covered_by) : null;
              const isCovered = !!split.covered_by;
              const isSettled = split.status === 'settled' && !isCovered;
              const isCoverExpense = expense.split_method === 'cover';

              const canToggleSettle =
                !isCovered &&
                (canManage ||
                  currentUserId === split.user_id ||
                  (!isCoverExpense && currentUserId === expense.paid_by));

              const canCover =
                !isCovered &&
                !isCoverExpense &&
                split.status === 'open' &&
                currentUserId !== split.user_id &&
                !!currentUserId;

              const canUncover =
                isCovered &&
                (currentUserId === split.covered_by || canManage);

              return (
                <View key={split.id} className="flex-row items-center justify-between py-sm">
                  <View className="flex-row items-center gap-sm flex-1">
                    <View className={`w-[32px] h-[32px] rounded-full items-center justify-center ${
                      isCovered ? 'bg-primary/20' : isSettled ? 'bg-success/20' : 'bg-surface'
                    }`}>
                      <Ionicons
                        name={isCovered ? 'shield-checkmark-outline' : isSettled ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={isCovered ? colors.primary : isSettled ? colors.success : colors.textMuted}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-body text-text-primary" numberOfLines={1}>
                        {user?.name ?? 'Unknown'}
                      </Text>
                      <Text className={`text-body-small ${
                        isCovered ? 'text-primary' : isSettled ? 'text-success' : 'text-text-secondary'
                      }`}>
                        {isCovered
                          ? t('split.coveredBy', { name: coveredByUser?.name ?? 'Unknown' })
                          : `${formatCurrency(Number(split.amount_owed), currency)} · ${isSettled ? t('split.settled') : t('split.open')}`}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row gap-xs">
                    {/* Cover / Uncover */}
                    {canUncover && (
                      <Pressable
                        onPress={() => onUncover(split.id)}
                        className="px-md py-sm rounded-sm bg-surface border border-border"
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <Text className="text-body-small font-medium text-text-secondary">
                          {t('action.uncover')}
                        </Text>
                      </Pressable>
                    )}
                    {canCover && (
                      <Pressable
                        onPress={() => onCover(split.id)}
                        className="px-md py-sm rounded-sm bg-primary/10"
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <Text className="text-body-small font-medium text-primary">
                          {t('action.cover')}
                        </Text>
                      </Pressable>
                    )}

                    {/* Settle / Reopen (not for covered splits) */}
                    {canToggleSettle && !isCovered ? (
                      <Pressable
                        onPress={() => isSettled ? onUnsettle(split.id) : onSettle(split.id)}
                        className={`px-md py-sm rounded-sm ${isSettled ? 'bg-surface border border-border' : 'bg-success/10'}`}
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <Text className={`text-body-small font-medium ${isSettled ? 'text-text-secondary' : 'text-success'}`}>
                          {isSettled ? t('split.reopen') : t('split.settle')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          <View className="border-t border-border pt-sm mt-md">
            <Text className="text-text-secondary text-body-small text-center">
              {t('split.settledOf', {
                settled: owerSplits.filter((s) => s.status === 'settled' && !s.covered_by).length,
                total: owerSplits.length,
              })}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
