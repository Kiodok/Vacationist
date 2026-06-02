import { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { PrivatePackingListView } from '../../../src/features/stuff/components/PrivatePackingListView';
import { SharedPackingListView } from '../../../src/features/stuff/components/SharedPackingListView';
import { LostFoundListView } from '../../../src/features/stuff/components/LostFoundListView';
import { CopyPackingListSheet } from '../../../src/features/stuff/components/CopyPackingListSheet';

type StuffSegment = 'private' | 'shared' | 'lost-found';

export default function StuffTab() {
  const { t } = useTranslation('stuff');
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: members = [] } = useTripMembers(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);

  const [activeSegment, setActiveSegment] = useState<StuffSegment>('private');
  const [showCopySheet, setShowCopySheet] = useState(false);

  const memberNameMap = useMemo(
    () => new Map(members.map((m) => [m.user_id, m.user.name])),
    [members],
  );

  const segments: { key: StuffSegment; label: string }[] = [
    { key: 'private', label: t('segment.private') },
    { key: 'shared', label: t('segment.shared') },
    { key: 'lost-found', label: t('segment.lostFound') },
  ];

  return (
    <View className="flex-1">
      {/* Segment control */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-xs px-md pt-sm pb-xs"
        style={{ flexGrow: 0 }}
      >
        {segments.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setActiveSegment(key)}
            className={`px-md py-sm rounded-full ${activeSegment === key ? 'bg-primary' : 'bg-surface'}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className={`text-body-small font-semibold ${activeSegment === key ? 'text-white' : 'text-text-secondary'}`}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab content */}
      {activeSegment === 'private' && (
        <PrivatePackingListView
          tripId={tripId!}
          onCopyToTrip={() => setShowCopySheet(true)}
        />
      )}

      {activeSegment === 'shared' && (
        <SharedPackingListView
          tripId={tripId!}
          currentUserId={user?.id}
          role={role}
          memberNameMap={memberNameMap}
        />
      )}

      {activeSegment === 'lost-found' && (
        <LostFoundListView
          tripId={tripId!}
          currentUserId={user?.id}
          role={role}
          members={members}
          memberNameMap={memberNameMap}
        />
      )}

      <CopyPackingListSheet
        visible={showCopySheet}
        currentTripId={tripId!}
        onClose={() => setShowCopySheet(false)}
      />
    </View>
  );
}
