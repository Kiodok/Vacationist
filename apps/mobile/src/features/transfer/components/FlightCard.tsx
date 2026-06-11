import { View, Text, Pressable, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TransferFlight, TransferFlightVote, VoteType } from '@vacationist/types';
import { VoteChip, VoteSummary } from '../../activities/components/VoteChip';
import { colors, METADATA_ICON_COLORS } from '@vacationist/ui';
import { useHighlightAnimation } from '../../../hooks/useHighlightAnimation';

const VOTE_SCORE: Record<VoteType, number> = {
  must_do: 5,
  like: 4,
  open: 3,
  skip: 2,
  group_blocker: 1,
};

function getVoteBorderColor(votes: { vote: VoteType }[]): string {
  if (votes.length === 0) return colors.border;
  if (votes.some((v) => v.vote === 'group_blocker')) return colors.danger;
  const avg = votes.reduce((sum, v) => sum + VOTE_SCORE[v.vote], 0) / votes.length;
  if (avg >= 4.0) return colors.success;
  if (avg >= 3.0) return colors.border;
  return colors.warning;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDatetime(value: string | null): string | null {
  if (!value) return null;
  const match = value.replace(' ', 'T').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  return `${parseInt(match[3])} ${MONTHS[parseInt(match[2]) - 1]}, ${match[4]}:${match[5]}`;
}

interface FlightCardProps {
  flight: TransferFlight;
  votes: TransferFlightVote[];
  currentUserId: string | undefined;
  currency: string;
  isWinner: boolean;
  onPress: () => void;
  onVotePress: () => void;
  detail?: React.ReactNode;
  highlight?: boolean;
}

export function FlightCard({ flight, votes, currentUserId, currency, isWinner, onPress, onVotePress, detail, highlight }: FlightCardProps) {
  const { t } = useTranslation('activities');
  const { t: tTransfer } = useTranslation('transfer');
  const myVote = votes.find((v) => v.user_id === currentUserId);
  const showBreakdown = !flight.voting_open;
  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';
  const borderColor = isWinner && !flight.voting_open ? colors.success : getVoteBorderColor(votes);

  const { animatedBorderColor } = useHighlightAnimation(highlight, borderColor);

  const departureFormatted = formatDatetime(flight.departure_time);
  const arrivalFormatted = formatDatetime(flight.arrival_time);
  const returnDepartureFormatted = formatDatetime(flight.return_departure_time);
  const returnArrivalFormatted = formatDatetime(flight.return_arrival_time);
  const isRoundTrip = flight.direction === 'outbound-return';

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
        {/* Header row */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1 gap-xs">
            <View className="flex-row items-center gap-xs flex-wrap">
              <Text className="text-body text-text-primary font-semibold" numberOfLines={2}>
                {flight.title}
              </Text>
              {isWinner && !flight.voting_open && (
                <View className="px-xs py-[2px] rounded-full bg-success/20">
                  <Text className="text-success text-label font-semibold">{tTransfer('flight.winner')}</Text>
                </View>
              )}
            </View>
            {flight.airline && (
              <Text className="text-body-small text-text-secondary">{flight.airline}</Text>
            )}
          </View>
          <FlightStatusIndicator status={flight.status} votingOpen={flight.voting_open} />
        </View>

        {/* Route & times — outbound leg */}
        {(flight.departure_airport || flight.arrival_airport) && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="airplane-outline" size={14} color={METADATA_ICON_COLORS.airplane.color} />
            <Text className="text-body-small text-text-secondary">
              {isRoundTrip ? `${tTransfer('all.direction.outPrefix')} ` : ''}{[flight.departure_airport, flight.arrival_airport].filter(Boolean).join(' → ')}
            </Text>
          </View>
        )}
        {(departureFormatted || arrivalFormatted) && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="time-outline" size={14} color={METADATA_ICON_COLORS.time.color} />
            <Text className="text-body-small text-text-secondary">
              {isRoundTrip ? `${tTransfer('all.direction.outPrefix')} ` : ''}{[departureFormatted, arrivalFormatted].filter(Boolean).join(' → ')}
            </Text>
          </View>
        )}

        {/* Return leg (outbound-return only) */}
        {isRoundTrip && (flight.return_departure_airport || flight.return_arrival_airport) && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="return-up-back-outline" size={14} color={METADATA_ICON_COLORS.return.color} />
            <Text className="text-body-small text-text-secondary">
              {`${tTransfer('all.direction.retPrefix')} `}{[flight.return_departure_airport, flight.return_arrival_airport].filter(Boolean).join(' → ')}
            </Text>
          </View>
        )}
        {isRoundTrip && (returnDepartureFormatted || returnArrivalFormatted) && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="time-outline" size={14} color={METADATA_ICON_COLORS.time.color} />
            <Text className="text-body-small text-text-secondary">
              {`${tTransfer('all.direction.retPrefix')} `}{[returnDepartureFormatted, returnArrivalFormatted].filter(Boolean).join(' → ')}
            </Text>
          </View>
        )}

        {/* Booking info (when booked) */}
        {flight.status === 'booked' && (flight.flight_number || flight.booking_reference) && (
          <View className="flex-row gap-md flex-wrap">
            {flight.flight_number && (
              <View className="flex-row items-center gap-xs">
                <Ionicons name="barcode-outline" size={14} color={METADATA_ICON_COLORS.barcode.color} />
                <Text className="text-body-small text-text-secondary">{flight.flight_number}</Text>
              </View>
            )}
            {flight.booking_reference && (
              <View className="flex-row items-center gap-xs">
                <Ionicons name="receipt-outline" size={14} color={METADATA_ICON_COLORS.receipt.color} />
                <Text className="text-body-small text-text-secondary">{flight.booking_reference}</Text>
              </View>
            )}
          </View>
        )}

        {/* Price */}
        {flight.price_per_person != null && (
          <Text className="text-body-small text-text-secondary">
            {currencySymbol}{Number(flight.price_per_person).toFixed(2)} / person
          </Text>
        )}

        {/* Vote section */}
        <View className="mt-xs gap-xs">
          <View className="flex-row items-center gap-sm">
            {votes.length > 0 && <VoteSummary votes={votes} />}
            {showBreakdown ? null : myVote ? (
              <VoteChip vote={myVote.vote} size="sm" onPress={onVotePress} />
            ) : (
              <Pressable
                onPress={onVotePress}
                className="flex-row items-center gap-xs px-md py-sm rounded-full bg-primary/10"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Ionicons name="hand-left-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{tTransfer('vote.button')}</Text>
              </Pressable>
            )}
          </View>
          {votes.length > 0 && (
            <Pressable
              onPress={onVotePress}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-body-small text-text-primary">
                {tTransfer('vote.showCount', { count: votes.length })}
              </Text>
            </Pressable>
          )}
        </View>
      </Pressable>
      {detail}
    </Animated.View>
  );
}

function FlightStatusIndicator({ status, votingOpen }: { status: string; votingOpen: boolean }) {
  const { t } = useTranslation('transfer');
  if (votingOpen) {
    return (
      <View className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-primary/10">
        <View className="w-[6px] h-[6px] rounded-full bg-primary" />
        <Text className="text-primary text-label font-medium" numberOfLines={1}>{t('all.status.voting')}</Text>
      </View>
    );
  }

  const statusConfig: Record<string, { bg: string; text: string }> = {
    suggested: { bg: 'bg-primary/10',  text: 'text-primary' },
    booked:    { bg: 'bg-success/10',  text: 'text-success' },
    completed: { bg: 'bg-border/50',   text: 'text-text-muted' },
  };

  const cfg = statusConfig[status] ?? statusConfig.suggested;

  return (
    <View className={`px-sm py-xs rounded-full ${cfg.bg}`}>
      <Text className={`${cfg.text} text-label font-medium`} numberOfLines={1}>{t(`all.status.${status}`, { defaultValue: status })}</Text>
    </View>
  );
}
