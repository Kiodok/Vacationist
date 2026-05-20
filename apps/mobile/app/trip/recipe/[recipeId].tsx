import { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { RecipeIngredient, UpdateRecipeIngredientInput } from '@vacationist/types';
import { useRecipe, useUpdateRecipe, useDeleteRecipe } from '../../../src/features/recipes/hooks/useRecipes';
import { useAddIngredient, useUpdateIngredient, useDeleteIngredient } from '../../../src/features/recipes/hooks/useRecipeIngredients';
import { useAddRecipeToShoppingList } from '../../../src/features/recipes/hooks/useAddToShoppingList';
import { useIngredientsRealtime } from '../../../src/features/recipes/hooks/useIngredientsRealtime';
import { useShoppingLists } from '../../../src/features/shopping/hooks/useShoppingLists';
import { useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { IngredientRow } from '../../../src/features/recipes/components/IngredientRow';
import { AddIngredientInput } from '../../../src/features/recipes/components/AddIngredientInput';
import { EditRecipeSheet } from '../../../src/features/recipes/components/EditRecipeSheet';
import { AddToShoppingListSheet } from '../../../src/features/recipes/components/AddToShoppingListSheet';

export default function RecipeDetail() {
  const { recipeId, tripId } = useLocalSearchParams<{ recipeId: string; tripId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const goBackToTrip = () => {
    if (Platform.OS === 'web') {
      router.replace(`/trip/${tripId}?tab=Recipes`);
    } else {
      router.back();
    }
  };

  const { data: recipe, isLoading } = useRecipe(recipeId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const { data: shoppingLists } = useShoppingLists(tripId!);
  const updateRecipeMut = useUpdateRecipe(tripId!);
  const deleteRecipeMut = useDeleteRecipe(tripId!);
  const addIngredientMut = useAddIngredient(recipeId!, tripId!);
  const updateIngredientMut = useUpdateIngredient(recipeId!, tripId!);
  const deleteIngredientMut = useDeleteIngredient(recipeId!, tripId!);
  const addToListMut = useAddRecipeToShoppingList(tripId!);

  useIngredientsRealtime(recipeId!, tripId!);

  const [showEdit, setShowEdit] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<RecipeIngredient | null>(null);

  const canEdit = role === 'organizer' || recipe?.created_by === user?.id;
  const canDelete = role === 'organizer' || recipe?.created_by === user?.id;
  const isGuest = role === 'guest';

  const handleAddIngredient = (title: string, quantity: number | null, unit: string | null) => {
    addIngredientMut.mutate({ title, quantity, unit });
  };

  const handleAddToShoppingList = (shoppingListId: string, targetServings: number) => {
    addToListMut.mutate(
      { recipeId: recipeId!, shoppingListId, targetServings },
      { onSuccess: () => setShowAddToList(false) },
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-md gap-md">
        <Text className="text-text-secondary text-body text-center">Recipe not found.</Text>
        <Pressable onPress={goBackToTrip} className="px-lg py-sm rounded-md bg-surface border border-border">
          <Text className="text-text-primary text-body">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-md pt-md pb-sm gap-sm">
        <Pressable onPress={goBackToTrip} className="p-xs">
          <Ionicons name="arrow-back" size={24} color="#F2F2F2" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-heading-m text-text-primary" numberOfLines={1}>
            {recipe.title}
          </Text>
          <Text className="text-body-small text-text-secondary">
            {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''} · {recipe.ingredient_count} ingredient{recipe.ingredient_count !== 1 ? 's' : ''}
          </Text>
        </View>
        <View className="flex-row items-center gap-xs">
          {!isGuest && (
            <Pressable
              onPress={() => setShowAddToList(true)}
              className="p-xs"
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.7 })}
            >
              <Ionicons name="cart-outline" size={22} color="#6C63FF" />
            </Pressable>
          )}
          {canEdit && (
            <Pressable
              onPress={() => setShowEdit(true)}
              className="p-xs"
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.7 })}
            >
              <Ionicons name="create-outline" size={20} color="#A0A0A0" />
            </Pressable>
          )}
          {canDelete && (
            <Pressable
              onPress={() => setConfirmDelete(true)}
              className="p-xs"
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.7 })}
            >
              <Ionicons name="trash-outline" size={20} color="#FF5C5C" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Description */}
      {recipe.description && (
        <View className="px-md pb-sm">
          <Text className="text-body-small text-text-secondary">{recipe.description}</Text>
        </View>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <View className="flex-row items-center justify-center gap-sm px-md py-sm bg-surface border-b border-border">
          <Text className="text-text-secondary text-body-small">Delete this recipe?</Text>
          <Pressable
            onPress={() => {
              deleteRecipeMut.mutate(recipeId!, { onSuccess: goBackToTrip });
              setConfirmDelete(false);
            }}
            className="px-md py-xs rounded-sm bg-danger/20"
          >
            <Text className="text-danger text-body-small font-semibold">Yes, delete</Text>
          </Pressable>
          <Pressable onPress={() => setConfirmDelete(false)} className="px-md py-xs rounded-sm">
            <Text className="text-text-secondary text-body-small">Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* Ingredient inline edit */}
      {editingIngredient && canEdit && (
        <EditIngredientInline
          ingredient={editingIngredient}
          onSave={(input) => {
            updateIngredientMut.mutate(
              { ingredientId: editingIngredient.id, input },
              { onSuccess: () => setEditingIngredient(null) },
            );
          }}
          onCancel={() => setEditingIngredient(null)}
          isPending={updateIngredientMut.isPending}
        />
      )}

      {/* Ingredients list */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'android' ? 80 : 0}
      >
        <View className="px-md pt-sm pb-xs">
          <Text className="text-label text-text-muted uppercase">Ingredients</Text>
        </View>

        <FlatList
          data={recipe.recipe_ingredients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={recipe.recipe_ingredients.length === 0 ? { flex: 1 } : undefined}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-xl gap-sm">
              <Ionicons name="nutrition-outline" size={40} color="#5C5C5C" />
              <Text className="text-body text-text-secondary text-center">
                No ingredients yet. Add some below.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <IngredientRow
              ingredient={item}
              canEdit={canEdit}
              onEdit={canEdit ? () => setEditingIngredient(item) : undefined}
              onDelete={canEdit ? () => deleteIngredientMut.mutate(item.id) : undefined}
            />
          )}
        />

        {!isGuest && (
          <AddIngredientInput
            onAdd={handleAddIngredient}
            isPending={addIngredientMut.isPending}
          />
        )}
      </KeyboardAvoidingView>

      {/* Sheets */}
      {showEdit && (
        <EditRecipeSheet
          visible={showEdit}
          recipe={recipe}
          onClose={() => setShowEdit(false)}
          onSubmit={(input) => {
            updateRecipeMut.mutate(
              { recipeId: recipeId!, input },
              { onSuccess: () => setShowEdit(false) },
            );
          }}
          isPending={updateRecipeMut.isPending}
        />
      )}

      {showAddToList && (
        <AddToShoppingListSheet
          visible={showAddToList}
          onClose={() => setShowAddToList(false)}
          shoppingLists={shoppingLists ?? []}
          defaultServings={recipe.servings}
          onSubmit={handleAddToShoppingList}
          isPending={addToListMut.isPending}
        />
      )}
    </SafeAreaView>
  );
}

function EditIngredientInline({
  ingredient,
  onSave,
  onCancel,
  isPending,
}: {
  ingredient: RecipeIngredient;
  onSave: (input: UpdateRecipeIngredientInput) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(ingredient.title);
  const [quantity, setQuantity] = useState(ingredient.quantity?.toString() ?? '');
  const [unit, setUnit] = useState(ingredient.unit ?? '');

  const handleSave = () => {
    const parsedQty = quantity.trim() ? parseFloat(quantity.trim()) : null;
    onSave({
      title: title.trim() || undefined,
      quantity: parsedQty != null && !isNaN(parsedQty) ? parsedQty : null,
      unit: unit.trim() || null,
    });
  };

  return (
    <View className="px-md py-sm bg-surface border-b border-border gap-sm">
      <View className="flex-row items-center justify-between">
        <Text className="text-body-small text-text-secondary">Editing ingredient</Text>
        <View className="flex-row gap-sm">
          <Pressable onPress={onCancel}>
            <Text className="text-text-secondary text-body-small">Cancel</Text>
          </Pressable>
          <Pressable onPress={handleSave} disabled={isPending}>
            <Text className="text-primary text-body-small font-semibold">
              {isPending ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </View>
      <View className="flex-row gap-sm">
        <TextInput
          className="flex-1 bg-surface-elevated border border-border rounded-sm px-md py-xs text-text-primary text-body-small"
          value={title}
          onChangeText={setTitle}
          placeholder="Name"
          placeholderTextColor="#5C5C5C"
          maxLength={100}
          autoFocus
        />
        <TextInput
          className="w-[70px] bg-surface-elevated border border-border rounded-sm px-sm py-xs text-text-primary text-body-small"
          value={quantity}
          onChangeText={setQuantity}
          placeholder="Qty"
          placeholderTextColor="#5C5C5C"
          keyboardType="decimal-pad"
        />
        <TextInput
          className="w-[70px] bg-surface-elevated border border-border rounded-sm px-sm py-xs text-text-primary text-body-small"
          value={unit}
          onChangeText={setUnit}
          placeholder="Unit"
          placeholderTextColor="#5C5C5C"
          maxLength={50}
        />
      </View>
    </View>
  );
}
