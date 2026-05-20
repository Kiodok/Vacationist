import { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CreateRecipeInput, Recipe } from '@vacationist/types';
import { useRecipes, useCreateRecipe, useDeleteRecipe } from '../../../src/features/recipes/hooks/useRecipes';
import { useRecipesRealtime } from '../../../src/features/recipes/hooks/useRecipesRealtime';
import { useRecipeShoppingStatus } from '../../../src/features/recipes/hooks/useRecipeShoppingStatus';
import { useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { RecipeCard } from '../../../src/features/recipes/components/RecipeCard';
import { CreateRecipeSheet } from '../../../src/features/recipes/components/CreateRecipeSheet';
import { EmptyRecipes } from '../../../src/features/recipes/components/EmptyRecipes';

export default function RecipesTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: recipes, isLoading } = useRecipes(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const createRecipe = useCreateRecipe(tripId!);
  const deleteRecipeMut = useDeleteRecipe(tripId!);
  const { data: shoppingStatus } = useRecipeShoppingStatus(tripId!);

  useRecipesRealtime(tripId!);

  const [showCreate, setShowCreate] = useState(false);

  const canCreate = role !== 'guest';

  const handleCreate = (input: CreateRecipeInput) => {
    createRecipe.mutate(input, { onSuccess: () => setShowCreate(false) });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#6C63FF" />
      </View>
    );
  }

  const isEmpty = !recipes || recipes.length === 0;

  return (
    <View className="flex-1">
      {isEmpty ? (
        <View className="flex-1 px-md py-md">
          <EmptyRecipes />
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-md py-md gap-sm"
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
        />
      )}

      {canCreate && (
        <Pressable
          onPress={() => setShowCreate(true)}
          className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
          style={{ elevation: 6, zIndex: 10, shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      <CreateRecipeSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={createRecipe.isPending}
      />
    </View>
  );
}

function RecipeCardWrapper({
  recipe,
  tripId,
  currentUserId,
  role,
  shoppingListNames,
  onPress,
  onDelete,
}: {
  recipe: Recipe & { ingredient_count: number };
  tripId: string;
  currentUserId: string | undefined;
  role: string | null | undefined;
  shoppingListNames: string[];
  onPress: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canDelete = role === 'organizer' || recipe.created_by === currentUserId;

  const handleLongPress = () => {
    if (canDelete) setConfirmingDelete(true);
  };

  return (
    <View>
      <RecipeCard
        title={recipe.title}
        description={recipe.description}
        servings={recipe.servings}
        ingredientCount={recipe.ingredient_count}
        shoppingListNames={shoppingListNames}
        onPress={onPress}
        onLongPress={handleLongPress}
      />
      {confirmingDelete && (
        <View className="flex-row items-center justify-center gap-sm py-sm">
          <Text className="text-text-secondary text-body-small">Delete this recipe?</Text>
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
