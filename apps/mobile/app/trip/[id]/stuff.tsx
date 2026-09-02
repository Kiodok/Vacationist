import { useState, useMemo, useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { SegmentedControl } from '../../../src/components/SegmentedControl';
import { PrivatePackingListView } from '../../../src/features/stuff/components/PrivatePackingListView';
import { SharedPackingListView } from '../../../src/features/stuff/components/SharedPackingListView';
import { LostFoundListView } from '../../../src/features/stuff/components/LostFoundListView';
import { CopyPackingListSheet } from '../../../src/features/stuff/components/CopyPackingListSheet';

type StuffSegment = 'private' | 'shared' | 'lost-found';

export default function StuffTab() {
  const { t } = useTranslation('stuff');
  const { id: tripId, highlightId, stuffSegment } = useLocalSearchParams<{ id: string; highlightId?: string; stuffSegment?: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: members = [] } = useTripMembers(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);

  const [activeSegment, setActiveSegment] = useState<StuffSegment>('private');
  const [showCopySheet, setShowCopySheet] = useState(false);

  // Switch to the correct segment when arriving from a notification deep-link.
  useEffect(() => {
    if (stuffSegment === 'shared') setActiveSegment('shared');
    else if (highlightId) setActiveSegment('lost-found');
  }, [highlightId, stuffSegment]);

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
      <SegmentedControl
        segments={segments}
        activeKey={activeSegment}
        onChange={(key) => setActiveSegment(key as StuffSegment)}
      />

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
          highlightId={highlightId}
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
