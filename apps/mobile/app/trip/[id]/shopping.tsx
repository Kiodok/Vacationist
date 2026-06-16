import { useState, useMemo } from 'react';
import { View, Text, SectionList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import type { CreateShoppingListInput, ShoppingListWithCounts, ShoppingItem, CreateRecipeInput, Recipe } from '@vacationist/types';
import { useCollapsibleSections } from '../../../src/hooks/useCollapsibleSections';
import { CollapsibleSectionHeader } from '../../../src/components/CollapsibleSectionHeader';
import { useShoppingLists, useCreateShoppingList, useDeleteShoppingList, useArchiveShoppingList } from '../../../src/features/shopping/hooks/useShoppingLists';
import { useAllTripShoppingItems, useUpdateShoppingItemGlobal } from '../../../src/features/shopping/hooks/useShoppingItems';
import { useRecipes, useCreateRecipe, useDeleteRecipe } from '../../../src/features/recipes/hooks/useRecipes';
import { useRecipeShoppingStatus } from '../../../src/features/recipes/hooks/useRecipeShoppingStatus';
import { useRecipesRealtime } from '../../../src/features/recipes/hooks/useRecipesRealtime';
import { useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { ShoppingListCard } from '../../../src/features/shopping/components/ShoppingListCard';
import { ShoppingItemRow } from '../../../src/features/shopping/components/ShoppingItemRow';
import { RecipeCardWrapper } from '../../../src/features/recipes/components/RecipeCardWrapper';
import { CreateShoppingListSheet } from '../../../src/features/shopping/components/CreateShoppingListSheet';
import { CreateRecipeSheet } from '../../../src/features/recipes/components/CreateRecipeSheet';
import { EmptyShopping } from '../../../src/features/shopping/components/EmptyShopping';
import { EmptyRecipes } from '../../../src/features/recipes/components/EmptyRecipes';
import { colors, ThemedIcon } from '@vacationist/ui';
import type { IoniconsName } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';
import { getQueryDisplayState } from '../../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../src/components/OfflineEmptyState';

type ViewMode = 'lists' | 'all' | 'recipes';

const SECTION_CONFIG: Record<string, { icon: IoniconsName; iconColor: string; textClass: string }> = {
  active:    { icon: 'cart-outline',          iconColor: colors.textPrimary, textClass: 'text-text-primary' },
  completed: { icon: 'checkmark-done-outline', iconColor: colors.success,    textClass: 'text-success' },
  archived:  { icon: 'archive-outline',        iconColor: colors.textMuted,  textClass: 'text-text-muted' },
};

export default function ShoppingTab() {
  const { t } = useTranslation('shopping');
  const { t: tCommon } = useTranslation("common");
  const { id: tripId, view } = useLocalSearchParams<{ id: string; view?: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateRecipe, setShowCreateRecipe] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    view === 'recipes' ? 'recipes' : 'lists'
  );

  const listsQuery = useShoppingLists(tripId!);
  const { data: lists, refetch } = listsQuery;
  const listsUx = getQueryDisplayState(listsQuery);
  const recipesQuery = useRecipes(tripId!, viewMode === 'recipes');
  const { data: recipes, refetch: refetchRecipes } = recipesQuery;
  const recipesUx = getQueryDisplayState(recipesQuery);
  const { data: shoppingStatus } = useRecipeShoppingStatus(tripId!, viewMode === 'recipes');
  useRecipesRealtime(viewMode === 'recipes' ? tripId! : '');
  const { data: role } = useCurrentMemberRole(tripId!);
  const createList = useCreateShoppingList();
  const deleteList = useDeleteShoppingList();
  const archiveList = useArchiveShoppingList();
  const createRecipe = useCreateRecipe(tripId!);
  const deleteRecipeMut = useDeleteRecipe(tripId!);

  const canCreateRecipe = role !== 'guest';
  const { toggle, isCollapsed } = useCollapsibleSections();

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
    const raw: { key: string; title: string; originalCount: number; data: ShoppingListWithCounts[] }[] = [];
    if (activeLists.length > 0) {
      raw.push({ key: 'active', title: t('section.active'), originalCount: activeLists.length, data: activeLists });
    }
    if (completedLists.length > 0) {
      raw.push({ key: 'completed', title: t('section.completed'), originalCount: completedLists.length, data: completedLists });
    }
    if (archivedLists.length > 0) {
      raw.push({ key: 'archived', title: t('section.archived'), originalCount: archivedLists.length, data: archivedLists });
    }
    return raw.map((s) => ({ ...s, data: isCollapsed(s.key) ? [] : s.data }));
  }, [activeLists, completedLists, archivedLists, isCollapsed]);

  const handleCreate = (input: CreateShoppingListInput) => {
    setShowCreate(false);
    createList.mutate({ tripId: tripId!, input });
  };

  if (listsUx.showSkeleton || (viewMode === 'recipes' && recipesUx.showSkeleton)) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (listsUx.showOfflineEmpty || (viewMode === 'recipes' && recipesUx.showOfflineEmpty)) {
    return <OfflineEmptyState onRetry={() => { refetch(); if (viewMode === 'recipes') refetchRecipes(); }} />;
  }

  const isEmpty = !lists || lists.length === 0;

  return (
    <View className="flex-1">
      {/* View mode toggle */}
      <View className="flex-row gap-xs px-md pt-sm pb-xs">
        <Pressable
          onPress={() => setViewMode('lists')}
          className={`px-md py-sm rounded-full ${viewMode === 'lists' ? 'bg-primary' : 'bg-surface'}`}
        >
          <Text className={`text-body-small font-semibold ${viewMode === 'lists' ? 'text-white' : 'text-text-secondary'}`}>
            {t('toggle.lists')}
          </Text>
        </Pressable>
        {!isEmpty && (
          <Pressable
            onPress={() => setViewMode('all')}
            className={`px-md py-sm rounded-full ${viewMode === 'all' ? 'bg-primary' : 'bg-surface'}`}
          >
            <Text className={`text-body-small font-semibold ${viewMode === 'all' ? 'text-white' : 'text-text-secondary'}`}>
              {t('toggle.allItems')}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => setViewMode('recipes')}
          className={`px-md py-sm rounded-full ${viewMode === 'recipes' ? 'bg-primary' : 'bg-surface'}`}
        >
          <Text className={`text-body-small font-semibold ${viewMode === 'recipes' ? 'text-white' : 'text-text-secondary'}`}>
            {t('toggle.recipes')}
          </Text>
        </Pressable>
      </View>

      {viewMode === 'recipes' ? (
        <RecipesView
          tripId={tripId!}
          recipes={recipes}
          shoppingStatus={shoppingStatus}
          role={role}
          currentUserId={user?.id}
          isFetching={recipesUx.refreshing}
          onRefresh={refetchRecipes}
          onPress={(id) => router.push(`/trip/recipe/${id}?tripId=${tripId}`)}
          onDelete={(id) => deleteRecipeMut.mutate(id)}
        />
      ) : isEmpty ? (
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
          renderSectionHeader={({ section }) => {
            const cfg = SECTION_CONFIG[section.key] ?? SECTION_CONFIG.active;
            return (
              <CollapsibleSectionHeader
                icon={cfg.icon}
                iconColor={cfg.iconColor}
                textClass={cfg.textClass}
                title={section.title}
                count={section.originalCount}
                collapsed={isCollapsed(section.key)}
                onToggle={() => toggle(section.key)}
              />
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
              onDelete={() => deleteList.mutate({ listId: item.id, tripId: tripId! })}
              onArchive={() => archiveList.mutate({ listId: item.id, tripId: tripId! })}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-sm" />}
          refreshControl={
            <RefreshControl
              refreshing={listsUx.refreshing}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {(viewMode !== 'recipes' || canCreateRecipe) && (
        <Pressable
          onPress={() => viewMode === 'recipes' ? setShowCreateRecipe(true) : setShowCreate(true)}
          className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
          style={{ elevation: 6, zIndex: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
        >
          <ThemedIcon name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      <CreateShoppingListSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={isMutationBusy(createList)}
      />

      <CreateRecipeSheet
        visible={showCreateRecipe}
        onClose={() => setShowCreateRecipe(false)}
        onSubmit={(input: CreateRecipeInput) => {
          setShowCreateRecipe(false);
          createRecipe.mutate(input);
        }}
        isPending={isMutationBusy(createRecipe)}
      />
    </View>
  );
}

function RecipesView({
  tripId,
  recipes,
  shoppingStatus,
  role,
  currentUserId,
  isFetching,
  onRefresh,
  onPress,
  onDelete,
}: {
  tripId: string;
  recipes: (Recipe & { ingredient_count: number })[] | undefined;
  shoppingStatus: Record<string, { title: string }[]> | undefined;
  role: string | null | undefined;
  currentUserId: string | undefined;
  isFetching: boolean;
  onRefresh: () => void;
  onPress: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isEmpty = !recipes || recipes.length === 0;
  if (isEmpty) {
    return (
      <View className="flex-1 px-md py-md">
        <EmptyRecipes />
      </View>
    );
  }
  return (
    <FlashList
      data={recipes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 8 }}
      renderItem={({ item }) => (
        <RecipeCardWrapper
          recipe={item}
          tripId={tripId}
          currentUserId={currentUserId}
          role={role}
          shoppingListNames={(shoppingStatus?.[item.id] ?? []).map((l) => l.title)}
          onPress={() => onPress(item.id)}
          onDelete={() => onDelete(item.id)}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    />
  );
}

function AllItemsView({ tripId }: { tripId: string }) {
  const { t } = useTranslation("shopping");
  const allItemsQuery = useAllTripShoppingItems(tripId);
  const { data: allItems, refetch } = allItemsQuery;
  const allItemsUx = getQueryDisplayState(allItemsQuery);
  const updateItem = useUpdateShoppingItemGlobal();

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
    updateItem.mutate({ itemId: item.id, tripId, input: { status: newStatus } });
  };

  if (allItemsUx.showSkeleton) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (allItemsUx.showOfflineEmpty) {
    return <OfflineEmptyState onRetry={refetch} />;
  }

  if (!allItems || allItems.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-xl gap-sm">
        <ThemedIcon name="basket-outline" size={40} color="#5C5C5C" />
        <Text className="text-body text-text-secondary text-center">
          {t('noItems')}
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
      contentContainerStyle={{ paddingBottom: 32 }}
      renderSectionHeader={({ section }) => (
        <View className="flex-row items-center gap-xs pt-md pb-sm px-md bg-background">
          <ThemedIcon name="list-outline" size={16} color={colors.primary} />
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
  const { t } = useTranslation("shopping");
  const { t: tCommon } = useTranslation("common");
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
          <Text className="text-text-secondary text-body-small">{t('confirm.deleteList')}</Text>
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
            <Text className="text-danger text-body-small font-semibold">{t('confirm.deleteYes')}</Text>
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
              <Text className="text-text-secondary text-body-small font-semibold">{t('confirm.archiveInstead')}</Text>
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
            <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
