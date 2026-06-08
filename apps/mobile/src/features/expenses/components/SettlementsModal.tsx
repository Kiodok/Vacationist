import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { MemberBalance, User, Currency } from '@vacationist/types';
import { formatCurrency, isNegligible, computeSettlements } from '@vacationist/utils';
import { colors } from '@vacationist/ui';

interface SettlementsModalProps {
  visible: boolean;
  onClose: () => void;
  balances: MemberBalance[];
  members: Map<string, User>;
  currency: Currency;
  onSettleAll?: (debtor: string, creditor: string) => void;
  isSettlingAll?: boolean;
}

export function SettlementsModal({ visible, onClose, balances, members, currency, onSettleAll, isSettlingAll }: SettlementsModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('expenses');
  const settlements = computeSettlements(balances);
  const allSettled = settlements.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <Text className="text-heading-m text-text-primary mb-md">{t('modal.title')}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Per-member balances */}
            <Text className="text-body text-text-secondary font-semibold mb-sm">{t('modal.memberBalances')}</Text>
            <View className="gap-xs mb-lg">
              {balances.map((b) => {
                const user = members.get(b.user_id);
                const isPositive = !isNegligible(b.net_balance) && b.net_balance > 0;
                const isNegative = !isNegligible(b.net_balance) && b.net_balance < 0;
                return (
                  <View key={b.user_id} className="py-sm px-sm rounded-md bg-surface gap-xs">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-sm flex-1">
                        <View className="w-[28px] h-[28px] rounded-full bg-primary/15 items-center justify-center">
                          <Text className="text-primary text-label font-semibold">
                            {(user?.name ?? '?')[0].toUpperCase()}
                          </Text>
                        </View>
                        <Text className="text-body text-text-primary flex-1" numberOfLines={1}>
                          {user?.name ?? 'Unknown'}
                        </Text>
                      </View>
                      <Text className={`text-body font-semibold ${isPositive ? 'text-success' : isNegative ? 'text-danger' : 'text-text-muted'}`}>
                        {isPositive ? '+' : ''}{formatCurrency(b.net_balance, currency)}
                      </Text>
                    </View>
                    <View className="flex-row gap-md pl-[44px]">
                      <Text className="text-label text-text-muted">
                        {t('modal.paid', { amount: formatCurrency(b.total_paid, currency) })}
                      </Text>
                      <Text className="text-label text-text-muted">
                        {t('modal.owes', { amount: formatCurrency(b.total_owed, currency) })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Simplified settlements */}
            <Text className="text-body text-text-secondary font-semibold mb-sm">{t('modal.simplifiedSettlements')}</Text>
            {allSettled ? (
              <View className="items-center py-lg gap-sm">
                <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.success} />
                <Text className="text-body text-success font-medium">{t('modal.allSettled')}</Text>
                <Text className="text-body-small text-text-muted">{t('modal.noPayments')}</Text>
              </View>
            ) : (
              <View className="gap-sm">
                {settlements.map((s, i) => {
                  const fromUser = members.get(s.from);
                  const toUser = members.get(s.to);
                  return (
                    <View key={i} className="flex-row items-center py-sm px-sm rounded-md bg-surface gap-sm">
                      <View className="flex-1 flex-row items-center gap-xs flex-wrap">
                        <Text className="text-body text-text-primary font-medium" numberOfLines={1}>
                          {fromUser?.name ?? 'Unknown'}
                        </Text>
                        <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                        <Text className="text-body text-text-primary font-medium" numberOfLines={1}>
                          {toUser?.name ?? 'Unknown'}
                        </Text>
                        <Text className="text-body text-primary font-semibold">
                          {formatCurrency(s.amount, currency)}
                        </Text>
                      </View>
                      {onSettleAll && (
                        <Pressable
                          onPress={() => onSettleAll(s.from, s.to)}
                          disabled={isSettlingAll}
                          className="px-md py-sm rounded-sm bg-success/10"
                          style={({ pressed }) => ({ opacity: pressed || isSettlingAll ? 0.6 : 1 })}
                        >
                          <Text className="text-success text-body-small font-semibold">
                            {t('modal.settleAll')}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
                <Text className="text-label text-text-muted text-center mt-xs">
                  {t('modal.paymentsCount', { count: settlements.length })}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
