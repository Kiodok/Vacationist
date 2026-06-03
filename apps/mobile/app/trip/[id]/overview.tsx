import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { i18n as i18nInstance } from '@vacationist/i18n';
import { dayjs, formatCurrency } from '@vacationist/utils';
import type { UpdateTripInput } from '@vacationist/types';
import { useTrip, useUpdateTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { MemberAvatarGroup } from '../../../src/features/trips/components/MemberAvatarGroup';
import { EditTripSheet } from '../../../src/features/trips/components/EditTripSheet';
import { colors } from '@vacationist/ui';

export default function OverviewTab() {
  const { t } = useTranslation('trips');
  const { t: tCommon } = useTranslation("common");
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
            <Text className="text-body-small text-text-secondary">{t('overview.editTrip')}</Text>
          </Pressable>
        )}

        {trip.description ? (
          <View className="bg-surface border border-border rounded-md p-md">
            <Text className="text-body text-text-primary">{trip.description}</Text>
          </View>
        ) : null}

        {/* Quick stats — Days & Members row */}
        <View className="flex-row gap-sm">
          <View className="flex-1 bg-surface border border-border rounded-md p-md items-center gap-xs">
            <View style={styles.iconBadgeSuccess}>
              <Ionicons name="calendar-outline" size={20} color={colors.success} />
            </View>
            <Text className="text-heading-m text-text-primary">{duration}</Text>
            <Text className="text-body-small text-text-secondary">
              {t('overview.days')}
            </Text>
          </View>

          <View className="flex-1 bg-surface border border-border rounded-md p-md items-center gap-xs">
            <View style={styles.iconBadgePrimary}>
              <Ionicons name="people-outline" size={20} color={colors.primary} />
            </View>
            <Text className="text-heading-m text-text-primary">
              {trip.member_count}
            </Text>
            <Text className="text-body-small text-text-secondary">{t('overview.members')}</Text>
          </View>
        </View>

        {/* Budget — full-width row so long CHF values never overflow */}
        {trip.budget_per_person != null && (
          <View className="bg-surface border border-border rounded-md p-md flex-row items-center gap-md">
            <View style={styles.iconBadgeWarning}>
              <Ionicons name="wallet-outline" size={20} color={colors.warning} />
            </View>
            <View>
              <Text className="text-heading-m text-text-primary">
                {formatCurrency(trip.budget_per_person, trip.base_currency, i18nInstance.language === 'de' ? 'de-DE' : 'en-US')}
              </Text>
              <Text className="text-body-small text-text-secondary">{t('overview.budget')}</Text>
            </View>
          </View>
        )}

        {/* Members preview */}
        {members && members.length > 0 && (
          <View className="bg-surface border border-border rounded-md p-md">
            <Text className="text-label text-text-muted uppercase mb-sm">{t('overview.members')}</Text>
            <View className="flex-row items-center gap-md">
              <MemberAvatarGroup
                members={members.map((m) => ({
                  id: m.user_id,
                  name: m.user.name,
                  avatar_url: m.user.avatar_url,
                }))}
              />
              <Text className="text-body-small text-text-secondary">
                {tCommon('label.membersCount', { count: members.length })}
              </Text>
            </View>
          </View>
        )}

        {/* Info */}
        <View className="bg-surface border border-border rounded-md p-md gap-sm">
          <Text className="text-label text-text-muted uppercase">{t('overview.details')}</Text>
          <View className="flex-row justify-between">
            <Text className="text-body-small text-text-secondary">{t('overview.currency')}</Text>
            <Text className="text-body-small text-text-primary">{trip.base_currency}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-body-small text-text-secondary">{t('overview.timezone')}</Text>
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

const styles = StyleSheet.create({
  iconBadgePrimary: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(108,99,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBadgeSuccess: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(62,207,142,0.1)',
    borderWidth: 1, borderColor: 'rgba(62,207,142,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBadgeWarning: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
});
