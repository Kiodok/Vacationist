import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dayjs, formatCurrency } from '@vacationist/utils';
import type { UpdateTripInput } from '@vacationist/types';
import { useTrip, useUpdateTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { MemberAvatarGroup } from '../../../src/features/trips/components/MemberAvatarGroup';
import { EditTripSheet } from '../../../src/features/trips/components/EditTripSheet';

export default function OverviewTab() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip } = useTrip(id!);
  const { data: members } = useTripMembers(id!);
  const { data: role } = useCurrentMemberRole(id!);
  const updateTrip = useUpdateTrip();
  const [editOpen, setEditOpen] = useState(false);

  if (!trip) return null;

  const isOrganizer = role === 'organizer';
  const duration = dayjs(trip.end_date).diff(dayjs(trip.start_date), 'day') + 1;

  async function handleEditSubmit(input: UpdateTripInput) {
    try {
      await updateTrip.mutateAsync({ tripId: id!, input });
      setEditOpen(false);
    } catch {
      // onError toast shown by useUpdateTrip
    }
  }

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerClassName="px-md py-md gap-md">
        {/* Edit button — organizers only */}
        {isOrganizer && (
          <Pressable
            onPress={() => setEditOpen(true)}
            className="flex-row items-center justify-end gap-xs"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="pencil-outline" size={16} color="#A0A0A0" />
            <Text className="text-body-small text-text-secondary">Edit trip</Text>
          </Pressable>
        )}

        {trip.description ? (
          <View className="bg-surface border border-border rounded-md p-md">
            <Text className="text-body text-text-primary">{trip.description}</Text>
          </View>
        ) : null}

        {/* Quick stats */}
        <View className="flex-row gap-sm">
          <View className="flex-1 bg-surface border border-border rounded-md p-md items-center">
            <Ionicons name="calendar-outline" size={20} color="#A0A0A0" />
            <Text className="text-heading-m text-text-primary mt-xs">{duration}</Text>
            <Text className="text-body-small text-text-secondary">
              {duration === 1 ? 'Day' : 'Days'}
            </Text>
          </View>

          <View className="flex-1 bg-surface border border-border rounded-md p-md items-center">
            <Ionicons name="people-outline" size={20} color="#A0A0A0" />
            <Text className="text-heading-m text-text-primary mt-xs">
              {trip.member_count}
            </Text>
            <Text className="text-body-small text-text-secondary">Members</Text>
          </View>

          {trip.budget_per_person != null && (
            <View className="flex-1 bg-surface border border-border rounded-md p-md items-center">
              <Ionicons name="wallet-outline" size={20} color="#A0A0A0" />
              <Text className="text-heading-m text-text-primary mt-xs">
                {formatCurrency(trip.budget_per_person, trip.base_currency)}
              </Text>
              <Text className="text-body-small text-text-secondary">Budget/person</Text>
            </View>
          )}
        </View>

        {/* Members preview */}
        {members && members.length > 0 && (
          <View className="bg-surface border border-border rounded-md p-md">
            <Text className="text-label text-text-muted uppercase mb-sm">Members</Text>
            <View className="flex-row items-center gap-md">
              <MemberAvatarGroup
                members={members.map((m) => ({
                  id: m.user_id,
                  name: m.user.name,
                  avatar_url: m.user.avatar_url,
                }))}
              />
              <Text className="text-body-small text-text-secondary">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>
        )}

        {/* Info */}
        <View className="bg-surface border border-border rounded-md p-md gap-sm">
          <Text className="text-label text-text-muted uppercase">Details</Text>
          <View className="flex-row justify-between">
            <Text className="text-body-small text-text-secondary">Currency</Text>
            <Text className="text-body-small text-text-primary">{trip.base_currency}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-body-small text-text-secondary">Timezone</Text>
            <Text className="text-body-small text-text-primary">
              {trip.timezone.replace('Europe/', '')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {isOrganizer && (
        <EditTripSheet
          visible={editOpen}
          onClose={() => setEditOpen(false)}
          onSubmit={handleEditSubmit}
          isPending={updateTrip.isPending}
          trip={trip}
        />
      )}
    </>
  );
}
