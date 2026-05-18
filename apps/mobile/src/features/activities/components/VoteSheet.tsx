import { View, Text, Pressable, Modal } from 'react-native';
import { VOTE_TYPE, type VoteType } from '@vacationist/types';
import { VoteChip } from './VoteChip';

interface VoteRecord {
  user_id: string;
  vote: VoteType;
}

interface VoteSheetProps {
  visible: boolean;
  onClose: () => void;
  votes: VoteRecord[];
  currentUserId: string | undefined;
  votingOpen: boolean;
  onCastVote: (vote: VoteType) => void;
  onRemoveVote: () => void;
  isPending: boolean;
}

export function VoteSheet({
  visible,
  onClose,
  votes,
  currentUserId,
  votingOpen,
  onCastVote,
  onRemoveVote,
  isPending,
}: VoteSheetProps) {
  const myVote = votes.find((v) => v.user_id === currentUserId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-background/80"
          onPress={onClose}
        />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl">
          {/* Handle bar */}
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <Text className="text-heading-m text-text-primary mb-md">
            {votingOpen ? 'Cast your vote' : 'Vote breakdown'}
          </Text>

          {votingOpen ? (
            <View className="gap-sm">
              {myVote && (
                <Pressable
                  onPress={() => { if (!isPending) onRemoveVote(); }}
                  disabled={isPending}
                  className="mb-xs items-center py-sm"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-danger text-body-small">Remove my vote</Text>
                </Pressable>
              )}

              {VOTE_TYPE.map((voteType) => (
                <Pressable
                  key={voteType}
                  onPress={() => {
                    if (!isPending) onCastVote(voteType);
                  }}
                  disabled={isPending}
                  className="flex-row items-center gap-md"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <VoteChip
                    vote={voteType}
                    selected={myVote?.vote === voteType}
                    size="md"
                  />
                </Pressable>
              ))}
            </View>
          ) : (
            <VoteBreakdown votes={votes} />
          )}
        </View>
      </View>
    </Modal>
  );
}

function VoteBreakdown({ votes }: { votes: VoteRecord[] }) {
  const ordered: VoteType[] = ['must_do', 'like', 'open', 'skip', 'group_blocker'];

  const counts = votes.reduce<Partial<Record<VoteType, number>>>((acc, v) => {
    acc[v.vote] = (acc[v.vote] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <View className="gap-sm">
      {ordered.map((voteType) => {
        const count = counts[voteType] ?? 0;
        return (
          <View key={voteType} className="flex-row items-center justify-between">
            <VoteChip vote={voteType} size="md" />
            <Text className="text-text-primary text-body font-semibold">{count}</Text>
          </View>
        );
      })}
      <View className="border-t border-border pt-sm mt-xs">
        <Text className="text-text-secondary text-body-small text-center">
          {votes.length} total {votes.length === 1 ? 'vote' : 'votes'}
        </Text>
      </View>
    </View>
  );
}
