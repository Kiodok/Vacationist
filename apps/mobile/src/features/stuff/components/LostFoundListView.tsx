import { useState, useMemo, useRef, useEffect } from 'react';
import { View, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { colors , ThemedIcon } from '@vacationist/ui';
import type { CreateLostFoundCaseInput, UpdateLostFoundCaseInput, LostFoundCase } from '@vacationist/types';
import type { TripMemberWithUser } from '@vacationist/api';
import { useLostFoundCases, useCreateLostFoundCase, useUpdateLostFoundCase, useResolveLostFoundCase, useUnresolveLostFoundCase, useDeleteLostFoundCase } from '../hooks/useLostFoundCases';
import { LostFoundCaseCard } from './LostFoundCaseCard';
import { CreateLostFoundCaseSheet } from './CreateLostFoundCaseSheet';
import { EditLostFoundCaseSheet } from './EditLostFoundCaseSheet';
import { EmptyLostFound } from './EmptyPacking';
import { isMutationBusy } from '../../../utils/mutationStatus';
import { getQueryDisplayState } from '../../../hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../components/OfflineEmptyState';

interface LostFoundListViewProps {
  tripId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  members: TripMemberWithUser[];
  memberNameMap: Map<string, string>;
  highlightId?: string;
}

export function LostFoundListView({ tripId, currentUserId, role, members, memberNameMap, highlightId }: LostFoundListViewProps) {
  const casesQuery = useLostFoundCases(tripId);
  const { data: cases, refetch } = casesQuery;
  const ux = getQueryDisplayState(casesQuery);
  const createCase = useCreateLostFoundCase(tripId);
  const updateCase = useUpdateLostFoundCase(tripId);
  const resolveCase = useResolveLostFoundCase(tripId);
  const unresolveCase = useUnresolveLostFoundCase(tripId);
  const deleteCase = useDeleteLostFoundCase(tripId);

  const [showCreate, setShowCreate] = useState(false);
  const [editingCase, setEditingCase] = useState<LostFoundCase | null>(null);
  const listRef = useRef<FlashListRef<LostFoundCase>>(null);

  const sortedCases = useMemo(
    () => cases ? [...cases].sort((a, b) => Number(a.is_resolved) - Number(b.is_resolved)) : [],
    [cases],
  );

  useEffect(() => {
    if (!highlightId || !sortedCases.length) return;
    const idx = sortedCases.findIndex((c) => c.id === highlightId);
    if (idx < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: idx, animated: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightId, sortedCases]);

  const handleCreate = (input: CreateLostFoundCaseInput) => {
    setShowCreate(false);
    createCase.mutate({ tripId, input });
  };

  const handleUpdate = (caseId: string, input: UpdateLostFoundCaseInput) => {
    setEditingCase(null);
    updateCase.mutate({ caseId, tripId, input });
  };

  if (ux.showSkeleton) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (ux.showOfflineEmpty) {
    return <OfflineEmptyState onRetry={refetch} />;
  }

  const isEmpty = sortedCases.length === 0;

  return (
    <View className="flex-1">
      {isEmpty ? (
        <EmptyLostFound />
      ) : (
        <FlashList
          ref={listRef}
          data={sortedCases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 8, paddingBottom: 80 }}
          renderItem={({ item }) => (
            <LostFoundCaseCard
              lostFoundCase={item}
              memberNameMap={memberNameMap}
              currentUserId={currentUserId}
              role={role}
              highlight={item.id === highlightId}
              onResolve={() => resolveCase.mutate({ caseId: item.id, tripId })}
              onUnresolve={() => unresolveCase.mutate({ caseId: item.id, tripId })}
              onEdit={() => setEditingCase(item)}
              onDelete={() => deleteCase.mutate({ caseId: item.id, tripId })}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={ux.refreshing}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      <Pressable
        onPress={() => setShowCreate(true)}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 6, zIndex: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
      >
        <ThemedIcon name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <CreateLostFoundCaseSheet
        visible={showCreate}
        members={members}
        currentUserId={currentUserId}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={isMutationBusy(createCase)}
      />

      <EditLostFoundCaseSheet
        visible={!!editingCase}
        lostFoundCase={editingCase}
        members={members}
        currentUserId={currentUserId}
        onClose={() => setEditingCase(null)}
        onSubmit={handleUpdate}
        isPending={isMutationBusy(updateCase)}
      />
    </View>
  );
}
