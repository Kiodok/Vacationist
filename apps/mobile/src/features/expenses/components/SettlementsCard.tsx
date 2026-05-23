import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MemberBalance } from '@vacationist/types';
import { isNegligible } from '@vacationist/utils';
import { colors } from '@vacationist/ui';

interface SettlementsCardProps {
  balances: MemberBalance[];
  onPress: () => void;
}

export function SettlementsCard({ balances, onPress }: SettlementsCardProps) {
  const debtors = balances.filter((b) => !isNegligible(b.net_balance) && b.net_balance < 0);
  const allSettled = debtors.length === 0;

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface border border-border rounded-md p-md mb-sm"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-sm">
          <View className={`w-[36px] h-[36px] rounded-full items-center justify-center ${allSettled ? 'bg-success/15' : 'bg-primary/15'}`}>
            <Ionicons
              name={allSettled ? 'checkmark-done' : 'swap-horizontal'}
              size={20}
              color={allSettled ? colors.success : colors.primary}
            />
          </View>
          <View>
            <Text className="text-body text-text-primary font-semibold">Balances & Settlements</Text>
            <Text className="text-body-small text-text-secondary">
              {allSettled
                ? 'All settled up!'
                : `${debtors.length} unsettled debt${debtors.length === 1 ? '' : 's'}`}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#5C5C5C" />
      </View>
    </Pressable>
  );
}
