import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { dayjs, formatCurrency } from '@vacationist/utils';
import { colors , ThemedIcon } from '@vacationist/ui';
import type { SettlementReceipt, Currency } from '@vacationist/types';

interface SettlementReceiptDetailProps {
  visible: boolean;
  onClose: () => void;
  receipt: SettlementReceipt;
  currency?: Currency;
}

export function SettlementReceiptDetail({ visible, onClose, receipt, currency }: SettlementReceiptDetailProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('expenses');

  const settledByMember = receipt.snapshot.members.find((m) => m.user_id === receipt.settled_by);
  const displayCurrency = currency ?? receipt.currency;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]" style={{ paddingBottom: Math.max(insets.bottom, 32) }}>
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between mb-md">
            <View className="flex-row items-center gap-sm">
              <View className="w-[32px] h-[32px] rounded-full bg-success/15 items-center justify-center">
                <ThemedIcon name="receipt-outline" size={16} color={colors.success} />
              </View>
              <Text className="text-heading-m text-text-primary">{t('receipt.title')}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <ThemedIcon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Meta info */}
            <View className="bg-surface rounded-md px-sm py-sm mb-md gap-xs">
              <View className="flex-row items-center gap-xs">
                <ThemedIcon name="person-outline" size={14} color={colors.textMuted} />
                <Text className="text-body-small text-text-secondary">
                  {t('receipt.settledBy', { name: settledByMember?.name ?? '?' })}
                </Text>
              </View>
              <View className="flex-row items-center gap-xs">
                <ThemedIcon name="time-outline" size={14} color={colors.textMuted} />
                <Text className="text-body-small text-text-secondary">
                  {t('receipt.settledAt', { date: dayjs(receipt.created_at).format('ll · HH:mm') })}
                </Text>
              </View>
              <View className="flex-row items-center gap-xs">
                <ThemedIcon name="wallet-outline" size={14} color={colors.textMuted} />
                <Text className="text-body-small text-text-secondary">
                  {t('receipt.totalAmount', { amount: formatCurrency(receipt.total_amount, displayCurrency) })}
                </Text>
              </View>
              <View className="flex-row items-center gap-xs">
                <ThemedIcon name="checkmark-done-outline" size={14} color={colors.textMuted} />
                <Text className="text-body-small text-text-secondary">
                  {t('receipt.splitsCount', { count: receipt.splits_count })}
                </Text>
              </View>
            </View>

            {/* Settlement pairs */}
            <Text className="text-body text-text-secondary font-semibold mb-sm">
              {t('modal.simplifiedSettlements')}
            </Text>
            <View className="gap-xs mb-md">
              {receipt.snapshot.settlements.map((s, i) => (
                <View key={i} className="flex-row items-center py-sm px-sm rounded-md bg-surface gap-sm">
                  <View className="flex-1 flex-row items-center gap-xs flex-wrap">
                    <Text className="text-body text-text-primary font-medium" numberOfLines={1}>
                      {s.from_user_name}
                    </Text>
                    <ThemedIcon name="arrow-forward" size={14} color={colors.primary} />
                    <Text className="text-body text-text-primary font-medium" numberOfLines={1}>
                      {s.to_user_name}
                    </Text>
                  </View>
                  <Text className="text-body text-success font-semibold">
                    {formatCurrency(s.amount, displayCurrency)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Immutability notice */}
            <View className="flex-row items-center gap-xs py-sm px-sm rounded-md bg-surface/50 mb-xs">
              <ThemedIcon name="lock-closed-outline" size={12} color={colors.textMuted} />
              <Text className="text-label text-text-muted flex-1">
                {t('receipt.immutableNotice')}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
