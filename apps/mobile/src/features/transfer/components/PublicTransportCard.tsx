import { View, Text, Pressable, TouchableOpacity, Linking, Animated, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatCurrency, formatNaiveTimestamp } from '@vacationist/utils';
import type { TransferPublicTransport } from '@vacationist/types';
import { colors, METADATA_ICON_COLORS, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { useHighlightAnimation } from '../../../hooks/useHighlightAnimation';

interface PublicTransportCardProps {
  entry: TransferPublicTransport;
  onPress?: () => void;
  detail?: React.ReactNode;
  highlight?: boolean;
}

// A bare dayjs(value) parse here was a real bug (task 13): departure_time/arrival_time are
// TIMESTAMPTZ columns that store the literal wall-clock digits the user typed with no real UTC
// conversion (see CreatePublicTransportSheet's `${date}T${time}` construction) — dayjs(value)
// applies a genuine UTC→device-local conversion on top of that, shifting the displayed time by
// the viewer's device UTC offset. formatNaiveTimestamp reads the digits back verbatim instead.
function formatDatetime(value: string | null): string | null {
  return formatNaiveTimestamp(value, 'D MMM, HH:mm');
}

export function PublicTransportCard({ entry, onPress, detail, highlight }: PublicTransportCardProps) {
  const { t } = useTranslation('transfer');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const borderColor = colors.border;
  const { animatedBorderColor } = useHighlightAnimation(highlight, borderColor);
  const departure = formatDatetime(entry.departure_time);
  const arrival = formatDatetime(entry.arrival_time);

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
          <View className="flex-row items-center gap-xs flex-1">
            <Text className="text-body text-text-primary font-semibold flex-1" numberOfLines={1}>
              {entry.title}
            </Text>
            {entry.is_business && (
              <View
                className="w-[22px] h-[22px] rounded-full bg-primary/10 items-center justify-center"
                accessibilityLabel={t('publicTransport.field.businessExpense')}
              >
                <ThemedIcon name="briefcase-outline" size={12} color={colors.primary} />
              </View>
            )}
          </View>
        </View>

        {entry.company && (
          <Text className="text-body-small text-text-secondary">{entry.company}</Text>
        )}

        {(entry.departure_location || entry.arrival_location) && (
          <View className="flex-row items-center gap-xs">
            <ThemedIcon name="location-outline" size={14} color={METADATA_ICON_COLORS.location.color} />
            <Text className="text-body-small text-text-secondary" numberOfLines={1}>
              {[entry.departure_location, entry.arrival_location].filter(Boolean).join(' → ')}
            </Text>
          </View>
        )}

        {(departure || arrival) && (
          <View className="flex-row items-center gap-xs">
            <ThemedIcon name="time-outline" size={14} color={METADATA_ICON_COLORS.time.color} />
            <Text className="text-body-small text-text-secondary">
              {[departure, arrival].filter(Boolean).join(' → ')}
            </Text>
          </View>
        )}

        <View className="flex-row gap-md flex-wrap">
          {entry.booking_reference && (
            <View className="flex-row items-center gap-xs">
              <ThemedIcon name="receipt-outline" size={14} color={METADATA_ICON_COLORS.receipt.color} />
              <Text className="text-body-small text-text-secondary">{entry.booking_reference}</Text>
            </View>
          )}
          {entry.price_total != null && (
            <Text className="text-body-small text-text-secondary">
              {formatCurrency(Number(entry.price_total), entry.currency)}
            </Text>
          )}
        </View>

        {entry.external_url && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL(entry.external_url!)}
            className="flex-row items-center gap-xs"
          >
            <ThemedIcon name="link-outline" size={14} color={colors.primary} />
            <Text className="text-primary text-body-small underline" numberOfLines={1}>
              {entry.external_url}
            </Text>
          </TouchableOpacity>
        )}
      </Pressable>
      {detail}
    </Animated.View>
  );
}
