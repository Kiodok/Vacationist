import { useState, useMemo } from 'react';
import { View, Text, SectionList, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import type { PackingItem, CreatePackingItemInput, UpdatePackingItemInput } from '@vacationist/types';
import { usePackingItems, usePackingCategories, useCreatePackingItem, useUpdatePackingItem, useDeletePackingItem } from '../hooks/usePackingItems';
import { PackingItemRow } from './PackingItemRow';
import { CreatePackingItemSheet } from './CreatePackingItemSheet';
import { EditPackingItemSheet } from './EditPackingItemSheet';
import { EmptyPacking } from './EmptyPacking';
import { SEEDED_CATEGORY_I18N } from '../utils/categoryUtils';
import { isMutationBusy } from '../../../utils/mutationStatus';
import { getQueryDisplayState } from '../../../hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../components/OfflineEmptyState';

interface PrivatePackingListViewProps {
  tripId: string;
  onCopyToTrip: () => void;
}

export function PrivatePackingListView({ tripId, onCopyToTrip }: PrivatePackingListViewProps) {
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { t } = useTranslation('stuff');
  const { t: tCommon } = useTranslation('common');
  const itemsQuery = usePackingItems(tripId);
  const { data: items, refetch } = itemsQuery;
  const ux = getQueryDisplayState(itemsQuery);
  const { data: categories = [] } = usePackingCategories();
  const createItem = useCreatePackingItem(tripId);
  const updateItem = useUpdatePackingItem(tripId);
  const deleteItem = useDeletePackingItem(tripId);

  const [showCreate, setShowCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<PackingItem | null>(null);
  const [actionItemId, setActionItemId] = useState<string | null>(null);

  // Distinct custom category names used by the current user's items.
  const usedCustomCategories = useMemo(() => {
    if (!items) return [];
    const seen = new Set<string>();
    for (const item of items) {
      if (!SEEDED_CATEGORY_I18N[item.category]) seen.add(item.category);
    }
    return Array.from(seen).sort();
  }, [items]);

  // All unpacked items grouped by category, then ONE packed section at the bottom.
  const sections = useMemo(() => {
    if (!items || items.length === 0) return [];

    const unpackedByCategory: Record<string, PackingItem[]> = {};
    const allPacked: PackingItem[] = [];

    for (const item of items) {
      if (item.is_packed) {
        allPacked.push(item);
      } else {
        if (!unpackedByCategory[item.category]) unpackedByCategory[item.category] = [];
        unpackedByCategory[item.category].push(item);
      }
    }

    const result: { key: string; title: string; isPacked: boolean; data: PackingItem[] }[] = [];

    for (const [category, categoryItems] of Object.entries(unpackedByCategory)) {
      result.push({ key: `unpacked-${category}`, title: category, isPacked: false, data: categoryItems });
    }

    if (allPacked.length > 0) {
      result.push({ key: 'packed', title: t('section.packed'), isPacked: true, data: allPacked });
    }

    return result;
  }, [items, t]);

  const handleCreate = (input: CreatePackingItemInput) => {
    setShowCreate(false);
    createItem.mutate({ tripId, input });
  };

  const handleEdit = (itemId: string, input: UpdatePackingItemInput) => {
    setEditingItem(null);
    updateItem.mutate({ itemId, tripId, input });
  };

  const handleToggle = (item: PackingItem) => {
    updateItem.mutate({ itemId: item.id, tripId, input: { is_packed: !item.is_packed } });
    setActionItemId(null);
  };

  const handleDelete = (itemId: string) => {
    deleteItem.mutate({ itemId, tripId });
    setActionItemId(null);
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

  const isEmpty = !items || items.length === 0;

  return (
    <View className="flex-1">
      {isEmpty ? (
        <View className="flex-1">
          <EmptyPacking />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          windowSize={5}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
          renderSectionHeader={({ section }) => {
            const catKey = !section.isPacked ? SEEDED_CATEGORY_I18N[section.title] : undefined;
            const sectionLabel = catKey ? t(catKey) : section.title;
            return (
            <View className="flex-row items-center gap-xs pt-md pb-xs px-xs">
              {section.isPacked ? (
                <ThemedIcon name="checkmark-done-outline" size={14} color={colors.success} />
              ) : (
                <ThemedIcon name="list-outline" size={14} color={colors.primary} />
              )}
              <Text className={`text-body-small font-semibold ${section.isPacked ? 'text-success' : 'text-text-primary'}`}>
                {sectionLabel}
              </Text>
              <Text className="text-body-small text-text-muted">({section.data.length})</Text>
            </View>
            );
          }}
          renderItem={({ item }) => (
            <>
              <PackingItemRow
                item={item}
                onToggle={() => handleToggle(item)}
                onLongPress={() => setActionItemId(actionItemId === item.id ? null : item.id)}
              />
              {actionItemId === item.id && (
                <View className="flex-row items-center gap-sm py-xs px-md bg-surface rounded-sm mb-xs flex-wrap">
                  <Pressable
                    onPress={() => { setEditingItem(item); setActionItemId(null); }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(108, 99, 255, 0.15)' })}
                  >
                    <Text className="text-primary text-body-small font-semibold">{t('action.edit')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(item.id)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255, 92, 92, 0.2)' })}
                  >
                    <Text className="text-danger text-body-small font-semibold">{t('confirm.deleteYes')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setActionItemId(null)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 })}
                  >
                    <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
          refreshControl={
            <RefreshControl
              refreshing={ux.refreshing}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <Pressable
              onPress={onCopyToTrip}
              className="flex-row items-center gap-xs self-start mb-xs mt-sm"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <ThemedIcon name="copy-outline" size={14} color={colors.textSecondary} />
              <Text className="text-body-small text-text-secondary">{t('action.copyToTrip')}</Text>
            </Pressable>
          }
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => setShowCreate(true)}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 6, zIndex: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
      >
        <ThemedIcon name="add" size={28} color={isColorful ? colors.surfaceElevated : '#FFFFFF'} />
      </Pressable>

      <CreatePackingItemSheet
        visible={showCreate}
        categories={categories}
        usedCustomCategories={usedCustomCategories}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={isMutationBusy(createItem)}
      />

      <EditPackingItemSheet
        visible={!!editingItem}
        item={editingItem}
        categories={categories}
        onClose={() => setEditingItem(null)}
        onSubmit={handleEdit}
        isPending={isMutationBusy(updateItem)}
      />
    </View>
  );
}
