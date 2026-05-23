import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Accommodation, AccommodationVote, VoteType } from '@vacationist/types';
import { VoteChip, VoteSummary } from '../../activities/components/VoteChip';
import { colors } from '@vacationist/ui';

interface AccommodationCardProps {
  accommodation: Accommodation;
  votes: AccommodationVote[];
  currentUserId: string | undefined;
  currency: string;
  onPress: () => void;
  onVotePress: () => void;
  detail?: React.ReactNode;
}

export function AccommodationCard({ accommodation, votes, currentUserId, currency, onPress, onVotePress, detail }: AccommodationCardProps) {
  const myVote = votes.find((v) => v.user_id === currentUserId);
  const showBreakdown = !accommodation.voting_open;
  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';
  const borderColor = getVoteBorderColor(votes);

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
        <View className="flex-row items-start justify-between">
          <View className="flex-1 gap-xs">
            <Text className="text-body text-text-primary font-semibold" numberOfLines={1}>
              {accommodation.title}
            </Text>
            {accommodation.price_total != null && (
              <Text className="text-body-small text-text-secondary">
                {currencySymbol}{Number(accommodation.price_total).toFixed(2)}
              </Text>
            )}
          </View>
          <StatusIndicator status={accommodation.status} votingOpen={accommodation.voting_open} />
        </View>

        {accommodation.description && (
          <Text className="text-body-small text-text-secondary" numberOfLines={2}>
            {accommodation.description}
          </Text>
        )}

        {accommodation.external_url && (
          <View className="flex-row items-center gap-xs">
            <Ionicons name="link-outline" size={14} color="#A0A0A0" />
            <Text className="text-body-small text-text-secondary" numberOfLines={1}>
              External link
            </Text>
          </View>
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
                <Ionicons name="hand-left-outline" size={14} color={colors.primary} />
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

const VOTE_SCORE: Record<VoteType, number> = {
  must_do: 5,
  like: 4,
  open: 3,
  skip: 2,
  group_blocker: 1,
};

function getVoteBorderColor(votes: { vote: VoteType }[]): string {
  if (votes.length === 0) return '#555555';
  if (votes.some((v) => v.vote === 'group_blocker')) return colors.danger;

  const avg = votes.reduce((sum, v) => sum + VOTE_SCORE[v.vote], 0) / votes.length;
  if (avg >= 4.0) return colors.success;
  if (avg >= 3.0) return '#555555';
  return colors.warning;
}


function StatusIndicator({ status, votingOpen }: { status: string; votingOpen: boolean }) {
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
    requested: { bg: 'bg-warning/10', text: 'text-warning', label: 'Requested' },
    reserved: { bg: 'bg-success/10', text: 'text-success', label: 'Reserved' },
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
