import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { dayjs } from '@vacationist/utils';
import type { MemberBalance, User, Currency, SettlementReceipt } from '@vacationist/types';
import { formatCurrency, isNegligible, computeSettlements } from '@vacationist/utils';
import { colors , ThemedIcon } from '@vacationist/ui';

interface SettlementsModalProps {
  visible: boolean;
  onClose: () => void;
  balances: MemberBalance[];
  members: Map<string, User>;
  currency: Currency;
  onSettleAllExpenses?: () => void;
  isSettlingAll?: boolean;
  receipts?: SettlementReceipt[];
  isLoadingReceipts?: boolean;
  onViewReceipt?: (receiptId: string) => void;
}

export function SettlementsModal({
  visible,
  onClose,
  balances,
  members,
  currency,
  onSettleAllExpenses,
  isSettlingAll,
  receipts = [],
  isLoadingReceipts,
  onViewReceipt,
}: SettlementsModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('expenses');
  const { t: tCommon } = useTranslation('common');
  const [confirmingSettle, setConfirmingSettle] = useState(false);
  const settlements = computeSettlements(balances);
  const allSettled = settlements.length === 0;

  useEffect(() => {
    if (!visible) setConfirmingSettle(false);
  }, [visible]);

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

            {/* Simplified settlements (read-only) */}
            <Text className="text-body text-text-secondary font-semibold mb-sm">{t('modal.simplifiedSettlements')}</Text>
            {allSettled ? (
              <View className="items-center py-lg gap-sm mb-lg">
                <ThemedIcon name="checkmark-done-circle-outline" size={40} color={colors.success} />
                <Text className="text-body text-success font-medium">{t('modal.allSettled')}</Text>
                <Text className="text-body-small text-text-muted">{t('modal.noPayments')}</Text>
              </View>
            ) : (
              <View className="gap-sm mb-md">
                {settlements.map((s, i) => {
                  const fromUser = members.get(s.from);
                  const toUser = members.get(s.to);
                  return (
                    <View key={i} className="flex-row items-center py-sm px-sm rounded-md bg-surface gap-sm">
                      <View className="flex-1 flex-row items-center gap-xs flex-wrap">
                        <Text className="text-body text-text-primary font-medium" numberOfLines={1}>
                          {fromUser?.name ?? 'Unknown'}
                        </Text>
                        <ThemedIcon name="arrow-forward" size={14} color={colors.primary} />
                        <Text className="text-body text-text-primary font-medium" numberOfLines={1}>
                          {toUser?.name ?? 'Unknown'}
                        </Text>
                        <Text className="text-body text-primary font-semibold">
                          {formatCurrency(s.amount, currency)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
                <Text className="text-label text-text-muted text-center mt-xs">
                  {t('modal.paymentsCount', { count: settlements.length })}
                </Text>
              </View>
            )}

            {/* Global "Settle all" button / inline confirmation */}
            {!allSettled && onSettleAllExpenses && (
              confirmingSettle ? (
                <View className="rounded-md bg-surface border border-border px-sm py-sm mb-lg gap-sm">
                  <Text className="text-body text-text-primary font-semibold">{t('modal.settleAllConfirmTitle')}</Text>
                  <Text className="text-body-small text-text-secondary">{t('modal.settleAllConfirmBody')}</Text>
                  <View className="flex-row gap-sm mt-xs">
                    <Pressable
                      onPress={() => setConfirmingSettle(false)}
                      className="flex-1 py-sm rounded-md bg-surface-elevated items-center"
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text className="text-body text-text-secondary font-medium">{tCommon('button.cancel')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setConfirmingSettle(false); onSettleAllExpenses(); }}
                      disabled={isSettlingAll}
                      className="flex-1 py-sm rounded-md bg-success/15 items-center"
                      style={({ pressed }) => ({ opacity: pressed || isSettlingAll ? 0.6 : 1 })}
                    >
                      {isSettlingAll ? (
                        <ActivityIndicator size="small" color={colors.success} />
                      ) : (
                        <Text className="text-body text-success font-semibold">{t('modal.settleAllConfirmYes')}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setConfirmingSettle(true)}
                  disabled={isSettlingAll}
                  className="py-md rounded-md bg-success/10 items-center mb-lg"
                  style={({ pressed }) => ({ opacity: pressed || isSettlingAll ? 0.6 : 1 })}
                >
                  <View className="flex-row items-center gap-sm">
                    <ThemedIcon name="checkmark-done-outline" size={18} color={colors.success} />
                    <Text className="text-success font-semibold text-body">
                      {t('modal.settleAllGlobal')}
                    </Text>
                  </View>
                </Pressable>
              )
            )}

            {/* Transaction History */}
            <Text className="text-body text-text-secondary font-semibold mb-sm">{t('modal.transactionHistory')}</Text>
            {isLoadingReceipts ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
            ) : receipts.length === 0 ? (
              <View className="items-center py-md gap-xs mb-lg">
                <ThemedIcon name="receipt-outline" size={28} color={colors.textMuted} />
                <Text className="text-body-small text-text-muted">{t('modal.noReceipts')}</Text>
              </View>
            ) : (
              <View className="gap-sm mb-md">
                {receipts.map((receipt) => {
                  const settledByMember = receipt.snapshot.members.find((m) => m.user_id === receipt.settled_by);
                  return (
                    <Pressable
                      key={receipt.id}
                      onPress={() => onViewReceipt?.(receipt.id)}
                      className="py-sm px-sm rounded-md bg-surface gap-xs"
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-sm flex-1">
                          <View className="w-[28px] h-[28px] rounded-full bg-success/15 items-center justify-center">
                            <ThemedIcon name="receipt-outline" size={14} color={colors.success} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-body-small text-text-primary font-semibold" numberOfLines={1}>
                              {t('receipt.settledBy', { name: settledByMember?.name ?? '?' })}
                            </Text>
                            <Text className="text-label text-text-muted">
                              {dayjs(receipt.created_at).format('ll · HH:mm')}
                            </Text>
                          </View>
                        </View>
                        <View className="items-end gap-xs">
                          <Text className="text-body-small text-success font-semibold">
                            {formatCurrency(receipt.total_amount, currency)}
                          </Text>
                          <View className="flex-row items-center gap-xs">
                            <Text className="text-label text-text-muted">
                              {t('receipt.viewReceipt')}
                            </Text>
                            <ThemedIcon name="chevron-forward" size={12} color={colors.textMuted} />
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
