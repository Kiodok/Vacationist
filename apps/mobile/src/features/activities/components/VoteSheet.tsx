import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
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
  /** userId → display name; when provided the breakdown shows who voted what */
  memberMap?: Map<string, string>;
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
  memberMap,
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

          {/* Casting controls — only shown while voting is open */}
          {votingOpen && (
            <>
              <Text className="text-heading-m text-text-primary mb-md">Cast your vote</Text>
              <View className="gap-sm mb-md">
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
                    onPress={() => { if (!isPending) onCastVote(voteType); }}
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

              {/* Divider before breakdown */}
              {votes.length > 0 && (
                <View className="border-t border-border mb-md" />
              )}
            </>
          )}

          {/* Vote breakdown — always shown when there are votes */}
          {votes.length > 0 ? (
            <>
              <Text className="text-heading-m text-text-primary mb-md">
                {votingOpen ? "Who's voted so far" : 'Vote breakdown'}
              </Text>
              <VoteBreakdown votes={votes} memberMap={memberMap} />
            </>
          ) : !votingOpen ? (
            <Text className="text-body text-text-muted text-center py-md">No votes cast</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const VOTE_ORDER: VoteType[] = ['must_do', 'like', 'open', 'skip', 'group_blocker'];

function VoteBreakdown({
  votes,
  memberMap,
}: {
  votes: VoteRecord[];
  memberMap?: Map<string, string>;
}) {
  if (memberMap && memberMap.size > 0) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
        <View className="gap-xs">
          {VOTE_ORDER.flatMap((voteType) =>
            votes
              .filter((v) => v.vote === voteType)
              .map((v) => (
                <View key={v.user_id} className="flex-row items-center gap-sm py-xs">
                  <VoteChip vote={voteType} size="sm" />
                  <Text className="text-body-small text-text-primary flex-1">
                    {memberMap.get(v.user_id) ?? 'Unknown'}
                  </Text>
                </View>
              ))
          )}
          <View className="border-t border-border pt-sm mt-xs">
            <Text className="text-text-secondary text-body-small text-center">
              {votes.length} total {votes.length === 1 ? 'vote' : 'votes'}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  // Fallback: count-only view (memberMap not loaded yet)
  const counts = votes.reduce<Partial<Record<VoteType, number>>>((acc, v) => {
    acc[v.vote] = (acc[v.vote] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <View className="gap-sm">
      {VOTE_ORDER.map((voteType) => {
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
