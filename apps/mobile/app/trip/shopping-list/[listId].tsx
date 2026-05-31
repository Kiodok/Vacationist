import { useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ShoppingItem, UpdateShoppingItemInput } from '@vacationist/types';
import { useShoppingItems, useCreateShoppingItem, useUpdateShoppingItem, useDeleteShoppingItem } from '../../../src/features/shopping/hooks/useShoppingItems';
import { useShoppingRealtime } from '../../../src/features/shopping/hooks/useShoppingRealtime';
import { useShoppingLists, useUpdateShoppingList, useDeleteShoppingList, useArchiveShoppingList, useUnarchiveShoppingList } from '../../../src/features/shopping/hooks/useShoppingLists';
import { useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { ShoppingItemRow } from '../../../src/features/shopping/components/ShoppingItemRow';
import { AddShoppingItemInput } from '../../../src/features/shopping/components/AddShoppingItemInput';
import { EditShoppingItemSheet } from '../../../src/features/shopping/components/EditShoppingItemSheet';
import { EditShoppingListSheet } from '../../../src/features/shopping/components/EditShoppingListSheet';
import { colors } from '@vacationist/ui';

export default function ShoppingListDetail() {
  const { listId, tripId } = useLocalSearchParams<{ listId: string; tripId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const goBackToTrip = () => {
    if (Platform.OS === 'web') {
      router.replace(`/trip/${tripId}?tab=Shopping`);
    } else {
      router.back();
    }
  };

  const { data: lists } = useShoppingLists(tripId!);
  const list = lists?.find((l) => l.id === listId);

  const { data: items, isLoading, isFetching, refetch } = useShoppingItems(listId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const createItem = useCreateShoppingItem();
  const updateItem = useUpdateShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const deleteList = useDeleteShoppingList();
  const archiveList = useArchiveShoppingList();
  const unarchiveList = useUnarchiveShoppingList();

  useShoppingRealtime(listId!);

  const updateList = useUpdateShoppingList();
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [showEditList, setShowEditList] = useState(false);
  const [confirmDeleteList, setConfirmDeleteList] = useState(false);

  const isArchived = !!list?.archived_at;
  const canManageList = role === 'organizer' || list?.created_by === user?.id;

  const canEditItem = (item: ShoppingItem) =>
    role === 'organizer' || (role === 'participant' && item.created_by === user?.id);
  const canDeleteItem = (item: ShoppingItem) =>
    role === 'organizer' || (role === 'participant' && item.created_by === user?.id);

  const handleToggle = (item: ShoppingItem) => {
    const newStatus = item.status === 'open' ? 'bought' : 'open';
    updateItem.mutate({ itemId: item.id, listId: listId!, tripId: tripId!, input: { status: newStatus } });
  };

  const handleAdd = (title: string) => {
    createItem.mutate({ listId: listId!, tripId: tripId!, input: { title } });
  };

  const handleEditSubmit = (input: UpdateShoppingItemInput) => {
    if (!editingItem) return;
    updateItem.mutate(
      { itemId: editingItem.id, listId: listId!, tripId: tripId!, input },
      { onSuccess: () => setEditingItem(null) },
    );
  };

  const handleDelete = () => {
    if (!editingItem) return;
    deleteItem.mutate(
      { itemId: editingItem.id, listId: listId!, tripId: tripId! },
      { onSuccess: () => setEditingItem(null) },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-md pt-md pb-sm gap-sm">
        <Pressable onPress={() => goBackToTrip()} className="p-xs">
          <Ionicons name="arrow-back" size={24} color="#F2F2F2" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-heading-m text-text-primary" numberOfLines={1}>
            {list?.title ?? 'Shopping List'}
          </Text>
          {items && items.length > 0 && (
            <Text className="text-body-small text-text-secondary">
              {items.filter((i) => i.status === 'bought').length === items.length
                ? 'All done!'
                : `${items.filter((i) => i.status === 'bought').length}/${items.length} bought`}
            </Text>
          )}
        </View>
        {canManageList && (
          <View className="flex-row items-center gap-xs">
            <Pressable
              onPress={() => setShowEditList(true)}
              className="p-xs"
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.7 })}
            >
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </Pressable>
            {isArchived ? (
              <Pressable
                onPress={() => unarchiveList.mutate({ listId: listId!, tripId: tripId! })}
                className="p-xs"
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.7 })}
              >
                <Ionicons name="arrow-undo-outline" size={20} color="#A0A0A0" />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => archiveList.mutate({ listId: listId!, tripId: tripId! }, { onSuccess: () => goBackToTrip() })}
                className="p-xs"
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.7 })}
              >
                <Ionicons name="archive-outline" size={20} color="#A0A0A0" />
              </Pressable>
            )}
            <Pressable
              onPress={() => setConfirmDeleteList(true)}
              className="p-xs"
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.7 })}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        )}
      </View>

      {confirmDeleteList && (
        <View className="flex-row items-center justify-center gap-sm px-md py-sm bg-surface border-b border-border">
          <Text className="text-text-secondary text-body-small">Delete this entire list?</Text>
          <Pressable
            onPress={() => {
              deleteList.mutate({ listId: listId!, tripId: tripId! }, { onSuccess: () => goBackToTrip() });
              setConfirmDeleteList(false);
            }}
            className="px-md py-xs rounded-sm bg-danger/20"
          >
            <Text className="text-danger text-body-small font-semibold">Yes, delete</Text>
          </Pressable>
          <Pressable
            onPress={() => setConfirmDeleteList(false)}
            className="px-md py-xs rounded-sm"
          >
            <Text className="text-text-secondary text-body-small">Cancel</Text>
          </Pressable>
        </View>
      )}

      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'android' ? 80 : 0}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlashList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={items?.length === 0 ? { flex: 1 } : undefined}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-xl gap-sm">
                <Ionicons name="basket-outline" size={40} color="#5C5C5C" />
                <Text className="text-body text-text-secondary text-center">
                  No items yet. Add one below.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <ShoppingItemRow
                item={item}
                onToggle={() => handleToggle(item)}
                onDelete={canDeleteItem(item) ? () => deleteItem.mutate({ itemId: item.id, listId: listId!, tripId: tripId! }) : undefined}
                onLongPress={() => setEditingItem(item)}
              />
            )}
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

        <AddShoppingItemInput
          onAdd={handleAdd}
          isPending={createItem.isPending}
        />
      </KeyboardAvoidingView>

      {editingItem && (
        <EditShoppingItemSheet
          visible={!!editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={handleEditSubmit}
          onDelete={handleDelete}
          isPending={updateItem.isPending}
          item={editingItem}
          canEdit={canEditItem(editingItem)}
          canDelete={canDeleteItem(editingItem)}
        />
      )}

      <EditShoppingListSheet
        visible={showEditList}
        onClose={() => setShowEditList(false)}
        onSubmit={(input) => {
          updateList.mutate(
            { listId: listId!, tripId: tripId!, input },
            { onSuccess: () => setShowEditList(false) },
          );
        }}
        isPending={updateList.isPending}
        currentTitle={list?.title ?? ''}
      />
    </SafeAreaView>
  );
}
