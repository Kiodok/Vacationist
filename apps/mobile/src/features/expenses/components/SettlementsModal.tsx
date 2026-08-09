import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator, Platform, Linking } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { dayjs } from '@vacationist/utils';
import type { MemberBalance, User, Currency, SettlementReceipt } from '@vacationist/types';
import { formatCurrency, isNegligible, computeSettlements, formatSettlementShareText } from '@vacationist/utils';
import { colors , ThemedIcon } from '@vacationist/ui';
import { shareText } from '../../../utils/share';
import { useToastStore } from '../../../stores/toastStore';
import { BoundedVirtualList } from '../../../components/BoundedVirtualList';

interface SettlementsModalProps {
  visible: boolean;
  onClose: () => void;
  balances: MemberBalance[];
  members: Map<string, User>;
  currency: Currency;
  tripId: string;
  tripTitle: string;
  onSettleAllExpenses?: () => void;
  isSettlingAll?: boolean;
  receipts?: SettlementReceipt[];
  isLoadingReceipts?: boolean;
  onViewReceipt?: (receiptId: string) => void;
  /** "Show in X" — live balances/settlements are shown converted into this currency (display only, never affects settlement status). Receipts (immutable history) always stay in `currency` regardless. */
  displayCurrency?: Currency | null;
  convert?: (amount: number, from: Currency, to: Currency) => number | null;
  ratesAsOf?: string | null;
}

export function SettlementsModal({
  visible,
  onClose,
  balances,
  members,
  currency,
  tripId,
  tripTitle,
  onSettleAllExpenses,
  isSettlingAll,
  receipts = [],
  isLoadingReceipts,
  onViewReceipt,
  displayCurrency,
  convert,
  ratesAsOf,
}: SettlementsModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('expenses');
  const { t: tCommon } = useTranslation('common');
  const addToast = useToastStore((s) => s.addToast);
  const [confirmingSettle, setConfirmingSettle] = useState(false);
  const settlements = useMemo(() => computeSettlements(balances), [balances]);
  const allSettled = settlements.length === 0;

  const isForeignDisplay = !!displayCurrency && displayCurrency !== currency && !!convert;
  const effectiveCurrency = isForeignDisplay ? (displayCurrency as Currency) : currency;
  const displayAmount = (amount: number): number => {
    if (!isForeignDisplay) return amount;
    return convert!(amount, currency, displayCurrency as Currency) ?? amount;
  };

  async function handleShare() {
    const text = formatSettlementShareText({ settlements, members, currency, tripId, tripTitle });
    const result = await shareText({ text, title: `${tripTitle} — Balances & Settlements` });
    if (result === 'shared') addToast('success', t('toast.balancesShared'));
    if (result === 'copied') addToast('success', t('toast.balancesCopied'));
  }

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

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary flex-1">{t('modal.title')}</Text>
            <Pressable
              onPress={handleShare}
              className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-primary/10"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <ThemedIcon name={Platform.OS === 'web' ? 'copy-outline' : 'share-social-outline'} size={15} color={colors.primary} />
              <Text className="text-primary text-body-small font-medium">{t('modal.shareButton')}</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Per-member balances */}
            <Text className="text-body text-text-secondary font-semibold mb-sm">{t('modal.memberBalances')}</Text>
            <BoundedVirtualList
              data={balances}
              keyExtractor={(b) => b.user_id}
              itemHeight={56}
              style={{ marginBottom: 24 }}
              renderItem={(b) => {
                const user = members.get(b.user_id);
                const isPositive = !isNegligible(b.net_balance) && b.net_balance > 0;
                const isNegative = !isNegligible(b.net_balance) && b.net_balance < 0;
                return (
                  <View className="py-sm px-sm rounded-md bg-surface gap-xs mb-xs">
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
                        {isPositive ? '+' : ''}{formatCurrency(displayAmount(b.net_balance), effectiveCurrency)}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
            {isForeignDisplay && (
              <>
                <Text className="text-label text-text-muted -mt-md">
                  {t('modal.ratesAsOf', { date: ratesAsOf ?? '—', currency })}
                </Text>
                <Pressable onPress={() => Linking.openURL('https://www.exchangerate-api.com')} className="mb-lg">
                  <Text className="text-label text-text-muted underline">{t('field.ratesAttribution')}</Text>
                </Pressable>
              </>
            )}

            {/* Simplified settlements (read-only) */}
            <Text className="text-body text-text-secondary font-semibold mb-sm">{t('modal.simplifiedSettlements')}</Text>
            {allSettled ? (
              <View className="items-center py-lg gap-sm mb-lg">
                <ThemedIcon name="checkmark-done-circle-outline" size={40} color={colors.success} />
                <Text className="text-body text-success font-medium">{t('modal.allSettled')}</Text>
                <Text className="text-body-small text-text-muted">{t('modal.noPayments')}</Text>
              </View>
            ) : (
              <View className="mb-md">
                <BoundedVirtualList
                  data={settlements}
                  keyExtractor={(s, i) => `${s.from}_${s.to}_${i}`}
                  itemHeight={48}
                  renderItem={(s) => {
                    const fromUser = members.get(s.from);
                    const toUser = members.get(s.to);
                    return (
                      <View className="flex-row items-center py-sm px-sm rounded-md bg-surface gap-sm mb-sm">
                        <View className="flex-1 flex-row items-center gap-xs flex-wrap">
                          <Text className="text-body text-text-primary font-medium" numberOfLines={1}>
                            {fromUser?.name ?? 'Unknown'}
                          </Text>
                          <ThemedIcon name="arrow-forward" size={14} color={colors.primary} />
                          <Text className="text-body text-text-primary font-medium" numberOfLines={1}>
                            {toUser?.name ?? 'Unknown'}
                          </Text>
                          <Text className="text-body text-primary font-semibold">
                            {formatCurrency(displayAmount(s.amount), effectiveCurrency)}
                          </Text>
                        </View>
                      </View>
                    );
                  }}
                />
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
              <BoundedVirtualList
                data={receipts}
                keyExtractor={(receipt) => receipt.id}
                itemHeight={64}
                style={{ marginBottom: 16 }}
                renderItem={(receipt) => {
                  const settledByMember = receipt.snapshot.members.find((m) => m.user_id === receipt.settled_by);
                  return (
                    <Pressable
                      onPress={() => onViewReceipt?.(receipt.id)}
                      className="py-sm px-sm rounded-md bg-surface gap-xs mb-sm"
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
                }}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
