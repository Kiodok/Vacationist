import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayjs } from '@vacationist/utils';
import type { TransferFlight, TransferFlightVote, VoteType } from '@vacationist/types';
import { VoteChip, VoteSummary } from '../../activities/components/VoteChip';

const VOTE_SCORE: Record<VoteType, number> = {
  must_do: 5,
  like: 4,
  open: 3,
  skip: 2,
  group_blocker: 1,
};

function getVoteBorderColor(votes: { vote: VoteType }[]): string {
  if (votes.length === 0) return '#555555';
  if (votes.some((v) => v.vote === 'group_blocker')) return '#FF5C5C';
  const avg = votes.reduce((sum, v) => sum + VOTE_SCORE[v.vote], 0) / votes.length;
  if (avg >= 4.0) return '#3ECF8E';
  if (avg >= 3.0) return '#555555';
  return '#F5A623';
}

function formatDatetime(value: string | null): string | null {
  if (!value) return null;
  return dayjs(value).format('D MMM, HH:mm');
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
}

export function FlightCard({ flight, votes, currentUserId, currency, isWinner, onPress, onVotePress, detail }: FlightCardProps) {
  const myVote = votes.find((v) => v.user_id === currentUserId);
  const showBreakdown = !flight.voting_open;
  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';
  const borderColor = isWinner && !flight.voting_open ? '#3ECF8E' : getVoteBorderColor(votes);

  const departureFormatted = formatDatetime(flight.departure_time);
  const arrivalFormatted = formatDatetime(flight.arrival_time);

  return (
    <View
      className={`bg-surface border border-border ${detail ? 'rounded-t-md' : 'rounded-md'}`}
      style={{ borderColor }}
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
              <Text className="text-body text-text-primary font-semibold" numberOfLines={1}>
                {flight.title}
              </Text>
              {isWinner && !flight.voting_open && (
                <View className="px-xs py-[2px] rounded-full bg-success/20">
                  <Text className="text-success text-label font-semibold">Winner</Text>
                </View>
              )}
            </View>
            {flight.airline && (
              <Text className="text-body-small text-text-secondary">{flight.airline}</Text>
            )}
          </View>
          <FlightStatusIndicator status={flight.status} votingOpen={flight.voting_open} />
        </View>

        {/* Route & times */}
        {(flight.departure_airport || flight.arrival_airport) && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="airplane-outline" size={14} color="#A0A0A0" />
            <Text className="text-body-small text-text-secondary">
              {[flight.departure_airport, flight.arrival_airport].filter(Boolean).join(' → ')}
            </Text>
          </View>
        )}
        {(departureFormatted || arrivalFormatted) && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="time-outline" size={14} color="#A0A0A0" />
            <Text className="text-body-small text-text-secondary">
              {[departureFormatted, arrivalFormatted].filter(Boolean).join(' → ')}
            </Text>
          </View>
        )}

        {/* Booking info (when booked) */}
        {flight.status === 'booked' && (flight.flight_number || flight.booking_reference) && (
          <View className="flex-row gap-md flex-wrap">
            {flight.flight_number && (
              <View className="flex-row items-center gap-xs">
                <Ionicons name="barcode-outline" size={14} color="#A0A0A0" />
                <Text className="text-body-small text-text-secondary">{flight.flight_number}</Text>
              </View>
            )}
            {flight.booking_reference && (
              <View className="flex-row items-center gap-xs">
                <Ionicons name="receipt-outline" size={14} color="#A0A0A0" />
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
        <View className="flex-row items-center justify-between mt-xs">
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
                <Ionicons name="hand-left-outline" size={14} color="#6C63FF" />
                <Text className="text-primary text-body-small font-medium">Vote</Text>
              </Pressable>
            )}
          </View>
          <Text className="text-body-small text-text-muted">
            {votes.length} {votes.length === 1 ? 'vote' : 'votes'}
          </Text>
        </View>
      </Pressable>
      {detail}
    </View>
  );
}

function FlightStatusIndicator({ status, votingOpen }: { status: string; votingOpen: boolean }) {
  if (votingOpen) {
    return (
      <View className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-primary/10">
        <View className="w-[6px] h-[6px] rounded-full bg-primary" />
        <Text className="text-primary text-label font-medium">Voting</Text>
      </View>
    );
  }

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    suggested: { bg: 'bg-primary/10', text: 'text-primary', label: 'Suggested' },
    booked: { bg: 'bg-success/10', text: 'text-success', label: 'Booked' },
    completed: { bg: 'bg-border/50', text: 'text-text-muted', label: 'Done' },
  };

  const cfg = statusConfig[status] ?? statusConfig.suggested;

  return (
    <View className={`px-sm py-xs rounded-full ${cfg.bg}`}>
      <Text className={`${cfg.text} text-label font-medium`}>{cfg.label}</Text>
    </View>
  );
}
