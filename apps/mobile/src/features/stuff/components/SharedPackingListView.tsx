import { useState, useMemo } from 'react';
import { View, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import type { CreateSharedPackingItemInput, UpdateSharedPackingItemInput, SharedPackingItem } from '@vacationist/types';
import { useSharedPackingItems, useCreateSharedPackingItem, useClaimSharedPackingItem, useUnclaimSharedPackingItem, useDeleteSharedPackingItem, useUpdateSharedPackingItem } from '../hooks/useSharedPackingItems';
import { SharedPackingItemCard } from './SharedPackingItemCard';
import { CreateSharedPackingItemSheet } from './CreateSharedPackingItemSheet';
import { EditSharedPackingItemSheet } from './EditSharedPackingItemSheet';
import { EmptySharedPacking } from './EmptyPacking';
import { isMutationBusy } from '../../../utils/mutationStatus';
import { getQueryDisplayState } from '../../../hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../components/OfflineEmptyState';

interface SharedPackingListViewProps {
  tripId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  memberNameMap: Map<string, string>;
}

export function SharedPackingListView({ tripId, currentUserId, role, memberNameMap }: SharedPackingListViewProps) {
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const itemsQuery = useSharedPackingItems(tripId);
  const { data: items, refetch } = itemsQuery;
  const ux = getQueryDisplayState(itemsQuery);
  const createItem = useCreateSharedPackingItem(tripId);
  const claimItem = useClaimSharedPackingItem(tripId);
  const unclaimItem = useUnclaimSharedPackingItem(tripId);
  const updateItem = useUpdateSharedPackingItem(tripId);
  const deleteItem = useDeleteSharedPackingItem(tripId);

  const [showCreate, setShowCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<SharedPackingItem | null>(null);

  const sortedItems = useMemo(
    () => items ? [...items].sort((a, b) => Number(a.is_resolved) - Number(b.is_resolved)) : [],
    [items],
  );

  const handleCreate = (input: CreateSharedPackingItemInput) => {
    setShowCreate(false);
    createItem.mutate({ tripId, input });
  };

  const handleEdit = (itemId: string, input: UpdateSharedPackingItemInput) => {
    setEditingItem(null);
    updateItem.mutate({ itemId, tripId, input });
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

  const isEmpty = sortedItems.length === 0;

  return (
    <View className="flex-1">
      {isEmpty ? (
        <EmptySharedPacking />
      ) : (
        <FlashList
          data={sortedItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 80 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <SharedPackingItemCard
              item={item}
              memberNameMap={memberNameMap}
              currentUserId={currentUserId}
              role={role}
              onClaim={() => claimItem.mutate({ itemId: item.id, tripId })}
              onUnclaim={() => unclaimItem.mutate({ itemId: item.id, tripId })}
              onEdit={() => setEditingItem(item)}
              onDelete={() => deleteItem.mutate({ itemId: item.id, tripId })}
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
        <ThemedIcon name="add" size={28} color={isColorful ? colors.surfaceElevated : '#FFFFFF'} />
      </Pressable>

      <CreateSharedPackingItemSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={isMutationBusy(createItem)}
      />

      <EditSharedPackingItemSheet
        visible={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSubmit={handleEdit}
        isPending={isMutationBusy(updateItem)}
      />
    </View>
  );
}
