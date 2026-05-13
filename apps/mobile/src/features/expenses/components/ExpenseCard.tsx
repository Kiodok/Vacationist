import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Expense, ExpenseSplit, User, Currency } from '@vacationist/types';
import { formatCurrency } from '@vacationist/utils';

interface ExpenseCardProps {
  expense: Expense;
  splits: ExpenseSplit[];
  members: Map<string, User>;
  currentUserId: string | undefined;
  currency: Currency;
  onPress: () => void;
  detail?: React.ReactNode;
}

export function ExpenseCard({ expense, splits, members, currentUserId, currency, onPress, detail }: ExpenseCardProps) {
  const payer = members.get(expense.paid_by);
  const owerSplits = splits.filter((s) => s.user_id !== expense.paid_by);
  const settledCount = owerSplits.filter((s) => s.status === 'settled').length;
  const allSettled = owerSplits.length > 0 && settledCount === owerSplits.length;

  const mySplit = splits.find((s) => s.user_id === currentUserId);
  const iOwe = mySplit && mySplit.status === 'open' && expense.paid_by !== currentUserId;

  return (
    <View className={`bg-surface border border-border ${detail ? 'rounded-t-md' : 'rounded-md'}`}>
      <Pressable
        onPress={onPress}
        className="p-md gap-sm"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 gap-xs">
            <Text className="text-body text-text-primary font-semibold" numberOfLines={1}>
              {expense.title}
            </Text>
            <View className="flex-row items-center gap-xs">
              <Ionicons name="person-outline" size={13} color="#A0A0A0" />
              <Text className="text-body-small text-text-secondary">
                Paid by {payer?.name ?? 'Unknown'}
              </Text>
            </View>
          </View>
          <View className="items-end gap-xs">
            <Text className="text-body text-text-primary font-semibold">
              {formatCurrency(Number(expense.amount), currency)}
            </Text>
            <SettlementBadge allSettled={allSettled} settledCount={settledCount} totalCount={owerSplits.length} />
          </View>
        </View>

        {iOwe && mySplit && (
          <View className="flex-row items-center gap-xs px-sm py-xs rounded-sm bg-warning/10 self-start">
            <Ionicons name="alert-circle-outline" size={14} color="#F5A623" />
            <Text className="text-warning text-body-small font-medium">
              You owe {formatCurrency(Number(mySplit.amount_owed), currency)}
            </Text>
          </View>
        )}

        {expense.related_type !== 'manual' && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name={getRelatedIcon(expense.related_type)} size={14} color="#A0A0A0" />
            <Text className="text-body-small text-text-muted capitalize">
              {expense.related_type}
            </Text>
          </View>
        )}
      </Pressable>
      {detail}
    </View>
  );
}

function getRelatedIcon(relatedType: string): keyof typeof Ionicons.glyphMap {
  switch (relatedType) {
    case 'accommodation': return 'bed-outline';
    case 'activity': return 'compass-outline';
    case 'transport': return 'car-outline';
    case 'shopping': return 'cart-outline';
    default: return 'receipt-outline';
  }
}

function SettlementBadge({ allSettled, settledCount, totalCount }: { allSettled: boolean; settledCount: number; totalCount: number }) {
  if (totalCount === 0) return null;

  if (allSettled) {
    return (
      <View className="px-sm py-xs rounded-full bg-success/10">
        <Text className="text-success text-label font-medium">Settled</Text>
      </View>
    );
  }

  return (
    <View className="px-sm py-xs rounded-full bg-warning/10">
      <Text className="text-warning text-label font-medium">
        {settledCount}/{totalCount}
      </Text>
    </View>
  );
}
