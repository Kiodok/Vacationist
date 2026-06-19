import { useState } from 'react';
import { View, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import type { CreateRecipeInput } from '@vacationist/types';
import { useRecipes, useCreateRecipe, useDeleteRecipe } from '../../../src/features/recipes/hooks/useRecipes';
import { useRecipesRealtime } from '../../../src/features/recipes/hooks/useRecipesRealtime';
import { useRecipeShoppingStatus } from '../../../src/features/recipes/hooks/useRecipeShoppingStatus';
import { useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { RecipeCardWrapper } from '../../../src/features/recipes/components/RecipeCardWrapper';
import { CreateRecipeSheet } from '../../../src/features/recipes/components/CreateRecipeSheet';
import { EmptyRecipes } from '../../../src/features/recipes/components/EmptyRecipes';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';
import { getQueryDisplayState } from '../../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../src/components/OfflineEmptyState';

export default function RecipesTab() {
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const recipesQuery = useRecipes(tripId!);
  const { data: recipes, refetch } = recipesQuery;
  const ux = getQueryDisplayState(recipesQuery);
  const { data: role } = useCurrentMemberRole(tripId!);
  const createRecipe = useCreateRecipe(tripId!);
  const deleteRecipeMut = useDeleteRecipe(tripId!);
  const { data: shoppingStatus } = useRecipeShoppingStatus(tripId!);

  useRecipesRealtime(tripId!);

  const [showCreate, setShowCreate] = useState(false);

  const canCreate = role !== 'guest';

  const handleCreate = (input: CreateRecipeInput) => {
    setShowCreate(false);
    createRecipe.mutate(input);
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

  const isEmpty = !recipes || recipes.length === 0;

  return (
    <View className="flex-1">
      {isEmpty ? (
        <View className="flex-1 px-md py-md">
          <EmptyRecipes />
        </View>
      ) : (
        <FlashList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 8 }}
          renderItem={({ item }) => (
            <RecipeCardWrapper
              recipe={item}
              tripId={tripId!}
              currentUserId={user?.id}
              role={role}
              shoppingListNames={(shoppingStatus?.[item.id] ?? []).map((l) => l.title)}
              onPress={() => router.push(`/trip/recipe/${item.id}?tripId=${tripId}`)}
              onDelete={() => deleteRecipeMut.mutate(item.id)}
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

      {canCreate && (
        <Pressable
          onPress={() => setShowCreate(true)}
          className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
          style={{ elevation: 6, zIndex: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
        >
          <ThemedIcon name="add" size={28} color={isColorful ? colors.surfaceElevated : '#FFFFFF'} />
        </Pressable>
      )}

      <CreateRecipeSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={isMutationBusy(createRecipe)}
      />
    </View>
  );
}

