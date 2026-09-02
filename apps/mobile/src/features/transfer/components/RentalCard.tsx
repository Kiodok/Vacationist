import { View, Text, Pressable, TouchableOpacity, Linking, Animated, Platform } from 'react-native';
import { formatCurrency, formatNaiveTimestamp } from '@vacationist/utils';
import type { TransferRental, Currency } from '@vacationist/types';
import { colors, METADATA_ICON_COLORS, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { useHighlightAnimation } from '../../../hooks/useHighlightAnimation';

interface RentalCardProps {
  rental: TransferRental;
  currency: string;
  onPress?: () => void;
  detail?: React.ReactNode;
  highlight?: boolean;
}

export function RentalCard({ rental, currency, onPress, detail, highlight }: RentalCardProps) {
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const borderColor = colors.border;
  const { animatedBorderColor } = useHighlightAnimation(highlight, borderColor);

  return (
    <Animated.View
      className={`bg-surface ${detail ? 'rounded-t-md' : 'rounded-md'}`}
      style={{
        borderWidth: isColorful ? 2 : 1,
        borderColor: animatedBorderColor,
        ...(Platform.OS === 'web' ? { borderStyle: 'solid' as const, backgroundColor: colors.surface, ...(detail ? { borderTopLeftRadius: 12, borderTopRightRadius: 12 } : { borderRadius: 12 }) } : {}),
        ...(isColorful && Platform.OS === 'web' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : {}),
      }}
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
            <ThemedIcon name="location-outline" size={14} color={METADATA_ICON_COLORS.location.color} />
            <Text className="text-body-small text-text-secondary" numberOfLines={1}>
              {[rental.pickup_location, rental.dropoff_location].filter(Boolean).join(' → ')}
            </Text>
          </View>
        )}

        {(rental.pickup_date || rental.dropoff_date) && (
          <View className="flex-row items-center gap-xs">
            <ThemedIcon name="calendar-outline" size={14} color={METADATA_ICON_COLORS.calendar.color} />
            <Text className="text-body-small text-text-secondary">
              {[
                formatNaiveTimestamp(rental.pickup_date, 'D MMM'),
                formatNaiveTimestamp(rental.dropoff_date, 'D MMM'),
              ].filter(Boolean).join(' – ')}
            </Text>
          </View>
        )}

        <View className="flex-row gap-md flex-wrap">
          {rental.booking_reference && (
            <View className="flex-row items-center gap-xs">
              <ThemedIcon name="receipt-outline" size={14} color={METADATA_ICON_COLORS.receipt.color} />
              <Text className="text-body-small text-text-secondary">{rental.booking_reference}</Text>
            </View>
          )}
          {rental.price_total != null && (
            <Text className="text-body-small text-text-secondary">
              {formatCurrency(Number(rental.price_total), currency as Currency)}
            </Text>
          )}
        </View>

        {rental.external_url && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL(rental.external_url!)}
            className="flex-row items-center gap-xs"
          >
            <ThemedIcon name="link-outline" size={14} color={colors.primary} />
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
