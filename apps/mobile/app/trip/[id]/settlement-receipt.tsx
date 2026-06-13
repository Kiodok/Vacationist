import { View, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettlementReceipt } from '../../../src/features/expenses/hooks/useExpenses';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { SettlementReceiptDetail } from '../../../src/features/expenses/components/SettlementReceiptDetail';
import { colors } from '@vacationist/ui';

export default function SettlementReceiptScreen() {
  const { id: tripId, receiptId } = useLocalSearchParams<{ id: string; receiptId: string }>();
  const router = useRouter();
  const { t } = useTranslation('expenses');
  const { data: receipt, isLoading, isError } = useSettlementReceipt(receiptId ?? '');
  const { data: trip } = useTrip(tripId!);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} />
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
    />
  );
}
