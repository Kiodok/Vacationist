import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@vacationist/ui';
import { useTrip, useDeleteTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripMembers, useRemoveMember, useLeaveTrip, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useActiveInvites, useCreateInvite, useRevokeInvite } from '../../../src/features/trips/hooks/useInvites';
import { MemberAvatar } from '../../../src/features/trips/components/MemberAvatar';
import { useAuthStore } from '../../../src/stores/authStore';
import { useToastStore } from '../../../src/stores/toastStore';

const ROLE_LABELS: Record<string, string> = {
  organizer: 'Organizer',
  participant: 'Participant',
  guest: 'Guest',
};

export default function SettingsTab() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tripId = id!;
  const currentUser = useAuthStore((s) => s.user);

  const { data: trip } = useTrip(tripId);
  const { data: role } = useCurrentMemberRole(tripId);
  const { data: members } = useTripMembers(tripId);
  const { data: invites } = useActiveInvites(tripId);
  const deleteTrip = useDeleteTrip();
  const removeMember = useRemoveMember(tripId);
  const leaveTrip = useLeaveTrip(tripId);
  const createInvite = useCreateInvite(tripId);
  const revokeInvite = useRevokeInvite(tripId);

  const isOrganizer = role === 'organizer';
  const addToast = useToastStore((s) => s.addToast);

  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const [pendingLeave, setPendingLeave] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  async function handleCreateInvite() {
    try {
      const result = await createInvite.mutateAsync({ expires_in: '7d' });
      const link = `vacationist://join?token=${result.token}`;
      await Clipboard.setStringAsync(link);
      addToast('success', 'Invite link copied to clipboard');
    } catch {
      // onError toast shown by useCreateInvite
    }
  }

  if (!trip) return null;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerClassName="px-md py-md gap-lg">
      {/* Members section */}
      <View>
        <Text className="text-label text-text-muted uppercase mb-sm">Members</Text>
        <View className="bg-surface border border-border rounded-md">
          {members?.map((member, index) => {
            const canRemove = isOrganizer && member.user_id !== currentUser?.id;
            const isPending = pendingRemovalId === member.user_id;
            const isRemoving = removeMember.isPending && isPending;

            return (
              <View
                key={member.id}
                className={`flex-row items-center p-md gap-md ${
                  index > 0 ? 'border-t border-border' : ''
                }`}
              >
                <MemberAvatar
                  name={member.user.name}
                  avatarUrl={member.user.avatar_url}
                  size="md"
                />
                <View className="flex-1">
                  <Text className="text-body text-text-primary">{member.user.name}</Text>
                  <Text className="text-body-small text-text-secondary">
                    {ROLE_LABELS[member.role]}
                  </Text>
                </View>

                {canRemove && !isPending && (
                  <Pressable
                    onPress={() => setPendingRemovalId(member.user_id)}
                    hitSlop={12}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close-circle-outline" size={22} color="#FF5C5C" />
                  </Pressable>
                )}

                {canRemove && isPending && (
                  <View className="flex-row gap-xs items-center">
                    {isRemoving ? (
                      <ActivityIndicator size="small" color="#6C63FF" />
                    ) : (
                      <>
                        <Pressable
                          onPress={() => setPendingRemovalId(null)}
                          hitSlop={8}
                          className="px-sm py-xs rounded-sm bg-surface-elevated"
                        >
                          <Text className="text-body-small text-text-secondary">Cancel</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            removeMember.mutate(member.user_id, {
                              onSettled: () => setPendingRemovalId(null),
                            });
                          }}
                          hitSlop={8}
                          className="px-sm py-xs rounded-sm bg-danger"
                        >
                          <Text className="text-body-small text-white font-semibold">Remove</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Invite section */}
      {isOrganizer && (
        <View>
          <Text className="text-label text-text-muted uppercase mb-sm">Invite Link</Text>
          <View className="bg-surface border border-border rounded-md p-md gap-md">
            <Button
              label="Generate Invite Link"
              variant="secondary"
              onPress={handleCreateInvite}
              loading={createInvite.isPending}
              icon={<Ionicons name="link-outline" size={18} color="#6C63FF" />}
            />

            {invites && invites.length > 0 && (
              <View className="gap-sm">
                <Text className="text-body-small text-text-secondary">Active invites</Text>
                {invites.map((invite) => (
                  <View
                    key={invite.id}
                    className="flex-row items-center justify-between bg-surface-elevated rounded-sm p-sm"
                  >
                    <View className="flex-1">
                      <Text className="text-body-small text-text-primary" numberOfLines={1}>
                        ...{invite.token.slice(-8)}
                      </Text>
                      <Text className="text-label text-text-muted">
                        Uses: {invite.use_count}{invite.max_uses != null ? `/${invite.max_uses}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => revokeInvite.mutate(invite.id)}
                      className="p-xs"
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF5C5C" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Danger zone */}
      <View>
        <Text className="text-label text-text-muted uppercase mb-sm">Danger Zone</Text>
        <View className="gap-sm">

          {/* Leave Trip */}
          {!isOrganizer && !pendingLeave && (
            <Button
              label="Leave Trip"
              variant="secondary"
              onPress={() => setPendingLeave(true)}
              icon={<Ionicons name="exit-outline" size={18} color="#6C63FF" />}
            />
          )}
          {!isOrganizer && pendingLeave && (
            <View className="rounded-md border border-danger p-md gap-sm">
              <Text className="text-body-small text-text-secondary">
                Are you sure you want to leave this trip?
              </Text>
              <View className="flex-row gap-sm">
                <Pressable
                  onPress={() => setPendingLeave(false)}
                  className="flex-1 min-h-[44px] rounded-md border border-border items-center justify-center"
                  disabled={leaveTrip.isPending}
                >
                  <Text className="text-body text-text-secondary">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    try {
                      await leaveTrip.mutateAsync();
                      router.replace('/(tabs)');
                    } catch {
                      setPendingLeave(false);
                      // onError toast shown by useLeaveTrip
                    }
                  }}
                  className="flex-1 min-h-[44px] rounded-md bg-danger items-center justify-center"
                  disabled={leaveTrip.isPending}
                >
                  {leaveTrip.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-body text-white font-semibold">Leave</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* Delete Trip */}
          {isOrganizer && !pendingDelete && (
            <Pressable
              onPress={() => setPendingDelete(true)}
              className="min-h-[48px] rounded-md border border-danger items-center justify-center flex-row gap-sm"
            >
              <Ionicons name="trash-outline" size={18} color="#FF5C5C" />
              <Text className="text-body text-danger font-semibold">Delete Trip</Text>
            </Pressable>
          )}
          {isOrganizer && pendingDelete && (
            <View className="rounded-md border border-danger p-md gap-sm">
              <Text className="text-body-small text-text-secondary">
                This will archive the trip for all members. This cannot be undone.
              </Text>
              <View className="flex-row gap-sm">
                <Pressable
                  onPress={() => setPendingDelete(false)}
                  className="flex-1 min-h-[44px] rounded-md border border-border items-center justify-center"
                  disabled={deleteTrip.isPending}
                >
                  <Text className="text-body text-text-secondary">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    try {
                      await deleteTrip.mutateAsync(tripId);
                      router.replace('/(tabs)');
                    } catch {
                      setPendingDelete(false);
                      // onError toast shown by useDeleteTrip
                    }
                  }}
                  className="flex-1 min-h-[44px] rounded-md bg-danger items-center justify-center"
                  disabled={deleteTrip.isPending}
                >
                  {deleteTrip.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-body text-white font-semibold">Delete</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

        </View>
      </View>
    </ScrollView>
  );
}
