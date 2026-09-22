import { View, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettlementReceipt } from '../../../src/features/expenses/hooks/useExpenses';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { SettlementReceiptDetail } from '../../../src/features/expenses/components/SettlementReceiptDetail';
import { colors } from '@vacationist/ui';
import { useAuthStore } from '../../../src/stores/authStore';
import { useCurrencyConversion } from '../../../src/features/currencies/hooks/useCurrencies';
import { getQueryDisplayState } from '../../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../src/components/OfflineEmptyState';
import { QueryErrorState } from '../../../src/components/QueryErrorState';

export default function SettlementReceiptScreen() {
  const { id: tripId, receiptId } = useLocalSearchParams<{ id: string; receiptId: string }>();
  const router = useRouter();
  const { t } = useTranslation('expenses');
  const receiptQuery = useSettlementReceipt(receiptId ?? '');
  const { data: receipt, isError } = receiptQuery;
  const { data: trip } = useTrip(tripId!);
  const preferredCurrency = useAuthStore((s) => s.user?.preferred_currency ?? null);
  const { convert } = useCurrencyConversion();
  const ux = getQueryDisplayState(receiptQuery);

  if (ux.showSkeleton) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Paused (offline) with no cached receipt — not "receipt not found".
  if (ux.showOfflineEmpty) {
    return (
      <View className="flex-1 bg-background">
        <OfflineEmptyState onRetry={() => void receiptQuery.refetch()} />
      </View>
    );
  }

  if (ux.showError) {
    return (
      <View className="flex-1 bg-background">
        <QueryErrorState onRetry={() => void receiptQuery.refetch()} />
      </View>
    );
  }

  if (isError || !receipt) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-lg">
        <Text className="text-text-secondary text-body text-center">{t('receipt.notFound')}</Text>
      </View>
    );
  }

  return (
    <SettlementReceiptDetail
      visible
      onClose={() => router.back()}
      receipt={receipt}
      currency={trip?.base_currency}
      preferredCurrency={preferredCurrency}
      convert={convert}
    />
  );
}
