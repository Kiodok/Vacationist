import { View, Text, Pressable, TouchableOpacity, Linking, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import type { TransferRental } from '@vacationist/types';
import { colors, METADATA_ICON_COLORS } from '@vacationist/ui';
import { useHighlightAnimation } from '../../../hooks/useHighlightAnimation';

interface RentalCardProps {
  rental: TransferRental;
  currency: string;
  onPress: () => void;
  detail?: React.ReactNode;
  highlight?: boolean;
}

export function RentalCard({ rental, currency, onPress, detail, highlight }: RentalCardProps) {
  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';

  const borderColor = colors.border;
  const { animatedBorderColor } = useHighlightAnimation(highlight, borderColor);

  return (
    <Animated.View
      className={`bg-surface ${detail ? 'rounded-t-md' : 'rounded-md'}`}
      style={{ borderWidth: 1, borderColor: animatedBorderColor, ...(Platform.OS === 'web' ? { borderStyle: 'solid' as const } : {}) }}
    >
      <Pressable
        onPress={onPress}
        className="p-md gap-sm"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View className="flex-row items-start justify-between">
          <Text className="text-body text-text-primary font-semibold flex-1" numberOfLines={1}>
            {rental.title}
          </Text>
        </View>

        {rental.company && (
          <Text className="text-body-small text-text-secondary">{rental.company}</Text>
        )}

        {(rental.pickup_location || rental.dropoff_location) && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="location-outline" size={14} color={METADATA_ICON_COLORS.location.color} />
            <Text className="text-body-small text-text-secondary" numberOfLines={1}>
              {[rental.pickup_location, rental.dropoff_location].filter(Boolean).join(' → ')}
            </Text>
          </View>
        )}

        {(rental.pickup_date || rental.dropoff_date) && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="calendar-outline" size={14} color={METADATA_ICON_COLORS.calendar.color} />
            <Text className="text-body-small text-text-secondary">
              {[
                rental.pickup_date ? dayjs(rental.pickup_date).format('D MMM') : null,
                rental.dropoff_date ? dayjs(rental.dropoff_date).format('D MMM') : null,
              ].filter(Boolean).join(' – ')}
            </Text>
          </View>
        )}

        <View className="flex-row gap-md flex-wrap">
          {rental.booking_reference && (
            <View className="flex-row items-center gap-xs">
              <Ionicons name="receipt-outline" size={14} color={METADATA_ICON_COLORS.receipt.color} />
              <Text className="text-body-small text-text-secondary">{rental.booking_reference}</Text>
            </View>
          )}
          {rental.price_total != null && (
            <Text className="text-body-small text-text-secondary">
              {currencySymbol}{Number(rental.price_total).toFixed(2)}
            </Text>
          )}
        </View>

        {rental.external_url && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL(rental.external_url!)}
            className="flex-row items-center gap-xs"
          >
            <Ionicons name="link-outline" size={14} color={colors.primary} />
            <Text className="text-primary text-body-small underline" numberOfLines={1}>
              {rental.external_url}
            </Text>
          </TouchableOpacity>
        )}
      </Pressable>
      {detail}
    </Animated.View>
  );
}
