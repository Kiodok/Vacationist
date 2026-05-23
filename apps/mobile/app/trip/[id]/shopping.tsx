import { useState, useMemo } from 'react';
import { View, Text, SectionList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CreateShoppingListInput, ShoppingListWithCounts, ShoppingItem } from '@vacationist/types';
import { useShoppingLists, useCreateShoppingList, useDeleteShoppingList, useArchiveShoppingList } from '../../../src/features/shopping/hooks/useShoppingLists';
import { useAllTripShoppingItems, useUpdateShoppingItemGlobal } from '../../../src/features/shopping/hooks/useShoppingItems';
import { useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { ShoppingListCard } from '../../../src/features/shopping/components/ShoppingListCard';
import { ShoppingItemRow } from '../../../src/features/shopping/components/ShoppingItemRow';
import { CreateShoppingListSheet } from '../../../src/features/shopping/components/CreateShoppingListSheet';
import { EmptyShopping } from '../../../src/features/shopping/components/EmptyShopping';
import { colors } from '@vacationist/ui';

type ViewMode = 'lists' | 'all';

export default function ShoppingTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: lists, isLoading, isFetching, refetch } = useShoppingLists(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const createList = useCreateShoppingList(tripId!);
  const deleteList = useDeleteShoppingList(tripId!);
  const archiveList = useArchiveShoppingList(tripId!);

  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('lists');

  const { activeLists, completedLists, archivedLists } = useMemo(() => {
    const active: ShoppingListWithCounts[] = [];
    const completed: ShoppingListWithCounts[] = [];
    const archived: ShoppingListWithCounts[] = [];
    for (const l of lists ?? []) {
      if (l.archived_at) {
        archived.push(l);
      } else if (l.item_count > 0 && l.bought_count === l.item_count) {
        completed.push(l);
      } else {
        active.push(l);
      }
    }
    return { activeLists: active, completedLists: completed, archivedLists: archived };
  }, [lists]);

  const sections = useMemo(() => {
    const result: { key: string; title: string; data: ShoppingListWithCounts[] }[] = [];
    if (activeLists.length > 0) {
      result.push({ key: 'active', title: 'Active', data: activeLists });
    }
    if (completedLists.length > 0) {
      result.push({ key: 'completed', title: 'Completed', data: completedLists });
    }
    if (archivedLists.length > 0) {
      result.push({ key: 'archived', title: 'Archived', data: archivedLists });
    }
    return result;
  }, [activeLists, completedLists, archivedLists]);

  const handleCreate = (input: CreateShoppingListInput) => {
    createList.mutate(input, { onSuccess: () => setShowCreate(false) });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const isEmpty = !lists || lists.length === 0;

  return (
    <View className="flex-1">
      {/* View mode toggle */}
      {!isEmpty && (
        <View className="flex-row gap-xs px-md pt-sm pb-xs">
          <Pressable
            onPress={() => setViewMode('lists')}
            className={`px-md py-sm rounded-full ${viewMode === 'lists' ? 'bg-primary' : 'bg-surface'}`}
          >
            <Text className={`text-body-small font-semibold ${viewMode === 'lists' ? 'text-white' : 'text-text-secondary'}`}>
              Lists
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('all')}
            className={`px-md py-sm rounded-full ${viewMode === 'all' ? 'bg-primary' : 'bg-surface'}`}
          >
            <Text className={`text-body-small font-semibold ${viewMode === 'all' ? 'text-white' : 'text-text-secondary'}`}>
              All Items
            </Text>
          </Pressable>
        </View>
      )}

      {isEmpty ? (
        <View className="flex-1 px-md py-md">
          <EmptyShopping />
        </View>
      ) : viewMode === 'all' ? (
        <AllItemsView tripId={tripId!} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          windowSize={5}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
          contentContainerClassName="px-md py-md"
          renderSectionHeader={({ section }) => {
            const icon = section.key === 'active'
              ? 'cart-outline' as const
              : section.key === 'completed'
                ? 'checkmark-done-outline' as const
                : 'archive-outline' as const;
            const color = section.key === 'active' ? colors.textPrimary : section.key === 'completed' ? colors.success : colors.textMuted;
            const textClass = section.key === 'active' ? 'text-text-primary' : section.key === 'completed' ? 'text-success' : 'text-text-muted';
            return (
              <View className="flex-row items-center gap-xs pt-md pb-sm px-xs">
                <Ionicons name={icon} size={16} color={color} />
                <Text className={`text-body font-semibold ${textClass}`}>
                  {section.title}
                </Text>
                <Text className="text-body-small text-text-muted">
                  ({section.data.length})
                </Text>
              </View>
            );
          }}
          renderItem={({ item, section }) => (
            <ShoppingListCardWrapper
              list={item}
              tripId={tripId!}
              currentUserId={user?.id}
              role={role}
              isArchived={section.key === 'archived'}
              onPress={() => router.push(`/trip/shopping-list/${item.id}?tripId=${tripId}`)}
              onDelete={() => deleteList.mutate(item.id)}
              onArchive={() => archiveList.mutate(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-sm" />}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
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
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <CreateShoppingListSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={createList.isPending}
      />
    </View>
  );
}

function AllItemsView({ tripId }: { tripId: string }) {
  const { data: allItems, isLoading } = useAllTripShoppingItems(tripId);
  const updateItem = useUpdateShoppingItemGlobal(tripId);

  const sections = useMemo(() => {
    if (!allItems) return [];
    const byList: Record<string, (ShoppingItem & { list_title: string })[]> = {};
    for (const item of allItems) {
      if (!byList[item.list_title]) byList[item.list_title] = [];
      byList[item.list_title].push(item);
    }
    return Object.entries(byList).map(([title, items]) => ({
      key: title,
      title,
      data: items,
      boughtCount: items.filter((i) => i.status === 'bought').length,
    }));
  }, [allItems]);

  const handleToggle = (item: ShoppingItem) => {
    const newStatus = item.status === 'open' ? 'bought' : 'open';
    updateItem.mutate({ itemId: item.id, input: { status: newStatus } });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!allItems || allItems.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-xl gap-sm">
        <Ionicons name="basket-outline" size={40} color="#5C5C5C" />
        <Text className="text-body text-text-secondary text-center">
          No items across any list yet.
        </Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      windowSize={5}
      maxToRenderPerBatch={10}
      initialNumToRender={10}
      contentContainerClassName="pb-xl"
      renderSectionHeader={({ section }) => (
        <View className="flex-row items-center gap-xs pt-md pb-sm px-md bg-background">
          <Ionicons name="list-outline" size={16} color={colors.primary} />
          <Text className="text-body font-semibold text-text-primary">
            {section.title}
          </Text>
          <Text className="text-body-small text-text-muted">
            ({section.boughtCount}/{section.data.length})
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <ShoppingItemRow
          item={item}
          onToggle={() => handleToggle(item)}
        />
      )}
    />
  );
}

function ShoppingListCardWrapper({
  list,
  tripId,
  currentUserId,
  role,
  isArchived,
  onPress,
  onDelete,
  onArchive,
}: {
  list: ShoppingListWithCounts;
  tripId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  isArchived: boolean;
  onPress: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canDelete = role === 'organizer' || list.created_by === currentUserId;
  const canArchive = !isArchived && (role === 'organizer' || list.created_by === currentUserId);

  const handleLongPress = () => {
    if (canDelete) setConfirmingDelete(true);
  };

  return (
    <View style={isArchived ? { opacity: 0.5 } : undefined}>
      <ShoppingListCard
        title={list.title}
        itemCount={list.item_count}
        boughtCount={list.bought_count}
        onPress={onPress}
        onLongPress={handleLongPress}
      />
      {confirmingDelete && (
        <View className="flex-row items-center justify-center gap-sm py-sm">
          <Text className="text-text-secondary text-body-small">Delete this list?</Text>
          <Pressable
            onPress={() => { onDelete(); setConfirmingDelete(false); }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
              backgroundColor: 'rgba(255, 92, 92, 0.2)',
            })}
          >
            <Text className="text-danger text-body-small font-semibold">Yes, delete</Text>
          </Pressable>
          {canArchive && (
            <Pressable
              onPress={() => { onArchive(); setConfirmingDelete(false); }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 6,
                backgroundColor: 'rgba(160, 160, 160, 0.15)',
              })}
            >
              <Text className="text-text-secondary text-body-small font-semibold">Archive instead</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setConfirmingDelete(false)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 6,
            })}
          >
            <Text className="text-text-secondary text-body-small">Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
