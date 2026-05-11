import { View, Text, ScrollView, Pressable, Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@vacationist/ui';
import { useTrip, useDeleteTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripMembers, useRemoveMember, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useActiveInvites, useCreateInvite, useRevokeInvite } from '../../../src/features/trips/hooks/useInvites';
import { MemberAvatar } from '../../../src/features/trips/components/MemberAvatar';
import { useAuthStore } from '../../../src/stores/authStore';

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
  const createInvite = useCreateInvite(tripId);
  const revokeInvite = useRevokeInvite(tripId);

  const isOrganizer = role === 'organizer';

  async function handleCreateInvite() {
    const result = await createInvite.mutateAsync({ expires_in: '7d' });
    const link = `vacationist://join?token=${result.token}`;
    try {
      await Share.share({ message: `Join my trip on Vacationist!\n${link}` });
    } catch {
      // User dismissed the share dialog — invite is still created
    }
  }

  function handleRemoveMember(userId: string, name: string) {
    Alert.alert(
      'Remove member',
      `Remove ${name} from this trip?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMember.mutate(userId),
        },
      ]
    );
  }

  function handleLeaveTrip() {
    if (!currentUser) return;
    Alert.alert(
      'Leave trip',
      'Are you sure you want to leave this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await removeMember.mutateAsync(currentUser.id);
            router.replace('/(tabs)');
          },
        },
      ]
    );
  }

  function handleDeleteTrip() {
    Alert.alert(
      'Delete trip',
      'This will archive the trip for all members. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTrip.mutateAsync(tripId);
            router.replace('/(tabs)');
          },
        },
      ]
    );
  }

  if (!trip) return null;

  return (
    <ScrollView contentContainerClassName="px-md py-md gap-lg">
      {/* Members section */}
      <View>
        <Text className="text-label text-text-muted uppercase mb-sm">Members</Text>
        <View className="bg-surface border border-border rounded-md">
          {members?.map((member, index) => (
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
              {isOrganizer && member.user_id !== currentUser?.id && (
                <Pressable
                  onPress={() => handleRemoveMember(member.user_id, member.user.name)}
                  className="p-xs"
                >
                  <Ionicons name="close-circle-outline" size={22} color="#FF5C5C" />
                </Pressable>
              )}
            </View>
          ))}
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
          {!isOrganizer && (
            <Button
              label="Leave Trip"
              variant="secondary"
              onPress={handleLeaveTrip}
              icon={<Ionicons name="exit-outline" size={18} color="#6C63FF" />}
            />
          )}
          {isOrganizer && (
            <Pressable
              onPress={handleDeleteTrip}
              className="min-h-[48px] rounded-md border border-danger items-center justify-center flex-row gap-sm"
            >
              <Ionicons name="trash-outline" size={18} color="#FF5C5C" />
              <Text className="text-body text-danger font-semibold">Delete Trip</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
