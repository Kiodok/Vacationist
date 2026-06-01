import { useState, useMemo } from 'react';
import { View, Text, SectionList, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { CreateShoppingListInput, ShoppingListWithCounts, ShoppingItem, CreateRecipeInput, Recipe } from '@vacationist/types';
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
import { colors } from '@vacationist/ui';

type ViewMode = 'lists' | 'all' | 'recipes';

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

  const { data: lists, isLoading, isFetching, refetch } = useShoppingLists(tripId!);
  const { data: recipes, isLoading: recipesLoading, isFetching: recipesFetching, refetch: refetchRecipes } = useRecipes(tripId!, viewMode === 'recipes');
  const { data: shoppingStatus } = useRecipeShoppingStatus(tripId!, viewMode === 'recipes');
  useRecipesRealtime(viewMode === 'recipes' ? tripId! : '');
  const { data: role } = useCurrentMemberRole(tripId!);
  const createList = useCreateShoppingList();
  const deleteList = useDeleteShoppingList();
  const archiveList = useArchiveShoppingList();
  const createRecipe = useCreateRecipe(tripId!);
  const deleteRecipeMut = useDeleteRecipe(tripId!);

  const canCreateRecipe = role !== 'guest';

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
      result.push({ key: 'active', title: t('section.active'), data: activeLists });
    }
    if (completedLists.length > 0) {
      result.push({ key: 'completed', title: t('section.completed'), data: completedLists });
    }
    if (archivedLists.length > 0) {
      result.push({ key: 'archived', title: t('section.archived'), data: archivedLists });
    }
    return result;
  }, [activeLists, completedLists, archivedLists]);

  const handleCreate = (input: CreateShoppingListInput) => {
    createList.mutate({ tripId: tripId!, input }, { onSuccess: () => setShowCreate(false) });
  };

  if (isLoading || (viewMode === 'recipes' && recipesLoading)) {
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
          isFetching={recipesFetching && !recipesLoading}
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
              onDelete={() => deleteList.mutate({ listId: item.id, tripId: tripId! })}
              onArchive={() => archiveList.mutate({ listId: item.id, tripId: tripId! })}
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

      {(viewMode !== 'recipes' || canCreateRecipe) && (
        <Pressable
          onPress={() => viewMode === 'recipes' ? setShowCreateRecipe(true) : setShowCreate(true)}
          className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
          style={{ elevation: 6, zIndex: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      <CreateShoppingListSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={createList.isPending}
      />

      <CreateRecipeSheet
        visible={showCreateRecipe}
        onClose={() => setShowCreateRecipe(false)}
        onSubmit={(input: CreateRecipeInput) => createRecipe.mutate(input, { onSuccess: () => setShowCreateRecipe(false) })}
        isPending={createRecipe.isPending}
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
  const { data: allItems, isLoading } = useAllTripShoppingItems(tripId);
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
