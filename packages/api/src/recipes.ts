import { supabase } from './client';
import { broadcastShoppingItemsRemoved } from './shopping';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  Recipe,
  RecipeIngredient,
  RecipeWithIngredients,
  ShoppingItem,
  CreateRecipeInput,
  UpdateRecipeInput,
  CreateRecipeIngredientInput,
  UpdateRecipeIngredientInput,
} from '@vacationist/types';

// ---------------------------------------------------------------------------
// Recipe CRUD
// ---------------------------------------------------------------------------

export async function getRecipes(tripId: string): Promise<(Recipe & { ingredient_count: number })[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(id)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as (Recipe & { recipe_ingredients: { id: string }[] })[]).map(
    ({ recipe_ingredients: ingredients, ...recipe }) => ({
      ...recipe,
      ingredient_count: ingredients?.length ?? 0,
    }),
  );
}

export async function getRecipe(recipeId: string): Promise<RecipeWithIngredients> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*)')
    .eq('id', recipeId)
    .single();

  if (error) throw error;

  const raw = data as unknown as Recipe & { recipe_ingredients: RecipeIngredient[] };
  const ingredients = (raw.recipe_ingredients ?? []).sort((a, b) => a.sort_order - b.sort_order);

  return {
    ...raw,
    recipe_ingredients: ingredients,
    ingredient_count: ingredients.length,
  };
}

export async function createRecipe(tripId: string, input: CreateRecipeInput): Promise<Recipe> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      trip_id: tripId,
      title: input.title,
      description: input.description ?? null,
      servings: input.servings ?? 4,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Recipe;
}

export async function updateRecipe(recipeId: string, input: UpdateRecipeInput): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .update(input)
    .eq('id', recipeId)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Recipe;
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_recipe', { p_recipe_id: recipeId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Ingredient CRUD
// ---------------------------------------------------------------------------

export async function addIngredient(
  recipeId: string,
  input: CreateRecipeIngredientInput,
): Promise<RecipeIngredient> {
  const { data: maxRow } = await supabase
    .from('recipe_ingredients')
    .select('sort_order')
    .eq('recipe_id', recipeId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('recipe_ingredients')
    .insert({
      recipe_id: recipeId,
      title: input.title,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) throw error;

  const ingredient = data as unknown as RecipeIngredient;
  await propagateIngredientAdd(recipeId, ingredient);
  return ingredient;
}

export async function updateIngredient(
  ingredientId: string,
  input: UpdateRecipeIngredientInput,
): Promise<RecipeIngredient> {
  const { data: oldRow } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .eq('id', ingredientId)
    .single();

  const { data, error } = await supabase
    .from('recipe_ingredients')
    .update(input)
    .eq('id', ingredientId)
    .select()
    .single();

  if (error) throw error;

  const ingredient = data as unknown as RecipeIngredient;
  const oldIngredient = oldRow as unknown as RecipeIngredient | null;
  await propagateIngredientUpdate(ingredient, oldIngredient);
  return ingredient;
}

export async function deleteIngredient(ingredientId: string): Promise<void> {
  await propagateIngredientDelete(ingredientId);

  const { error } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('id', ingredientId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Ingredient → Shopping List propagation helpers
// ---------------------------------------------------------------------------

async function deriveRecipeScale(
  recipeId: string,
  shoppingListId: string,
): Promise<number> {
  const { data: items } = await supabase
    .from('shopping_items')
    .select('quantity, source_ingredient_id')
    .eq('shopping_list_id', shoppingListId)
    .eq('source_recipe_id', recipeId)
    .not('source_ingredient_id', 'is', null)
    .not('quantity', 'is', null)
    .is('deleted_at', null)
    .limit(5);

  if (!items?.length) return 1;

  const ingredientIds = items
    .map((i) => i.source_ingredient_id)
    .filter(Boolean) as string[];

  const { data: ingredients } = await supabase
    .from('recipe_ingredients')
    .select('id, quantity')
    .in('id', ingredientIds)
    .not('quantity', 'is', null);

  if (!ingredients?.length) return 1;

  const ingMap = new Map(ingredients.map((i) => [i.id, i.quantity as number]));

  for (const item of items) {
    const ingQty = ingMap.get(item.source_ingredient_id!);
    if (ingQty && item.quantity) {
      return item.quantity / ingQty;
    }
  }

  return 1;
}

async function getLinkedShoppingListIds(recipeId: string): Promise<string[]> {
  const { data } = await supabase.rpc('get_recipe_linked_lists', {
    p_recipe_id: recipeId,
  });

  if (!data?.length) return [];
  return data.map((r: { shopping_list_id: string }) => r.shopping_list_id);
}

async function propagateIngredientAdd(
  recipeId: string,
  ingredient: RecipeIngredient,
): Promise<void> {
  const listIds = await getLinkedShoppingListIds(recipeId);
  if (listIds.length === 0) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  for (const listId of listIds) {
    const scale = await deriveRecipeScale(recipeId, listId);
    const scaledQty =
      ingredient.quantity != null ? ingredient.quantity * scale : null;

    // Check for orphaned items (source_ingredient_id set to null by FK ON DELETE SET NULL)
    const { data: orphaned } = await supabase
      .from('shopping_items')
      .select('id')
      .eq('shopping_list_id', listId)
      .eq('source_recipe_id', recipeId)
      .eq('title', ingredient.title)
      .is('source_ingredient_id', null)
      .is('deleted_at', null)
      .limit(1)
      .single();

    if (orphaned) {
      await supabase
        .from('shopping_items')
        .update({
          title: ingredient.title,
          quantity: scaledQty,
          unit: ingredient.unit ?? null,
          source_ingredient_id: ingredient.id,
        })
        .eq('id', orphaned.id);
    } else {
      const { data: maxRow } = await supabase
        .from('shopping_items')
        .select('position')
        .eq('shopping_list_id', listId)
        .is('deleted_at', null)
        .order('position', { ascending: false })
        .limit(1)
        .single();

      const nextPosition = (maxRow?.position ?? -1) + 1;

      await supabase.from('shopping_items').insert({
        shopping_list_id: listId,
        title: ingredient.title,
        quantity: scaledQty,
        unit: ingredient.unit ?? null,
        position: nextPosition,
        source_recipe_id: recipeId,
        source_ingredient_id: ingredient.id,
        created_by: user.id,
      });
    }
  }
}

type LinkedShoppingItem = {
  id: string;
  shopping_list_id: string;
  source_recipe_id: string | null;
  source_ingredient_id: string | null;
};

async function findLinkedShoppingItems(
  ingredientId: string,
  recipeId: string,
  title: string,
): Promise<LinkedShoppingItem[]> {
  const { data: byId } = await supabase
    .from('shopping_items')
    .select('id, shopping_list_id, source_recipe_id, source_ingredient_id')
    .eq('source_ingredient_id', ingredientId)
    .is('deleted_at', null);

  const found = (byId ?? []) as LinkedShoppingItem[];
  if (found.length > 0) return found;

  const { data: byTitle } = await supabase
    .from('shopping_items')
    .select('id, shopping_list_id, source_recipe_id, source_ingredient_id')
    .eq('source_recipe_id', recipeId)
    .eq('title', title)
    .is('source_ingredient_id', null)
    .is('deleted_at', null);

  return (byTitle ?? []) as LinkedShoppingItem[];
}

async function propagateIngredientUpdate(
  ingredient: RecipeIngredient,
  oldIngredient: RecipeIngredient | null,
): Promise<void> {
  const matchTitle = oldIngredient ? oldIngredient.title : ingredient.title;

  const linkedItems = await findLinkedShoppingItems(
    ingredient.id,
    ingredient.recipe_id,
    matchTitle,
  );

  if (!linkedItems.length) return;

  for (const item of linkedItems) {
    const scale = item.source_recipe_id
      ? await deriveRecipeScale(item.source_recipe_id, item.shopping_list_id)
      : 1;

    const scaledQty =
      ingredient.quantity != null ? ingredient.quantity * scale : null;

    await supabase
      .from('shopping_items')
      .update({
        title: ingredient.title,
        quantity: scaledQty,
        unit: ingredient.unit ?? null,
        source_ingredient_id: ingredient.id,
      })
      .eq('id', item.id);
  }
}

async function propagateIngredientDelete(ingredientId: string): Promise<void> {
  const { data: ingredient } = await supabase
    .from('recipe_ingredients')
    .select('id, recipe_id, title')
    .eq('id', ingredientId)
    .single();

  if (!ingredient) return;

  const linkedItems = await findLinkedShoppingItems(
    ingredientId,
    ingredient.recipe_id,
    ingredient.title,
  );

  if (!linkedItems.length) return;

  const now = new Date().toISOString();
  const ids = linkedItems.map((i) => i.id);

  await supabase
    .from('shopping_items')
    .update({ deleted_at: now })
    .in('id', ids);

  const listIds = [...new Set(linkedItems.map((i) => i.shopping_list_id))];
  for (const listId of listIds) {
    const itemIds = linkedItems
      .filter((i) => i.shopping_list_id === listId)
      .map((i) => i.id);
    broadcastShoppingItemsRemoved(listId, itemIds);
  }
}

// ---------------------------------------------------------------------------
// Recipe Shopping Status (which recipes have items in shopping lists)
// ---------------------------------------------------------------------------

export interface RecipeShoppingListInfo {
  id: string;
  title: string;
}

export async function getRecipeShoppingStatus(
  tripId: string,
): Promise<Record<string, RecipeShoppingListInfo[]>> {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('source_recipe_id, shopping_list_id, shopping_lists!inner(trip_id, title)')
    .eq('shopping_lists.trip_id', tripId)
    .not('source_recipe_id', 'is', null)
    .is('deleted_at', null);

  if (error) throw error;

  const map: Record<string, RecipeShoppingListInfo[]> = {};
  for (const row of data ?? []) {
    const recipeId = row.source_recipe_id as string;
    const listId = row.shopping_list_id as string;
    const listTitle = (row.shopping_lists as unknown as { title: string }).title;
    if (!map[recipeId]) map[recipeId] = [];
    if (!map[recipeId].some((l) => l.id === listId)) {
      map[recipeId].push({ id: listId, title: listTitle });
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Add Recipe Ingredients → Shopping List (with duplicate merge + scaling)
// ---------------------------------------------------------------------------

export async function addRecipeToShoppingList(
  recipeId: string,
  shoppingListId: string,
  targetServings: number,
): Promise<{ added: number; merged: number }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const recipe = await getRecipe(recipeId);
  const ingredients = recipe.recipe_ingredients;

  if (ingredients.length === 0) {
    return { added: 0, merged: 0 };
  }

  const scale = targetServings / recipe.servings;

  const { data: existingItems, error: fetchErr } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('shopping_list_id', shoppingListId)
    .is('deleted_at', null);

  if (fetchErr) throw fetchErr;

  const existing = (existingItems ?? []) as unknown as ShoppingItem[];

  let added = 0;
  let merged = 0;

  const { data: maxRow } = await supabase
    .from('shopping_items')
    .select('position')
    .eq('shopping_list_id', shoppingListId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  let nextPosition = (maxRow?.position ?? -1) + 1;

  for (const ingredient of ingredients) {
    const scaledQty = ingredient.quantity != null ? ingredient.quantity * scale : null;

    const match = existing.find(
      (item) =>
        item.title.toLowerCase() === ingredient.title.toLowerCase() &&
        (item.unit ?? '') === (ingredient.unit ?? ''),
    );

    if (match) {
      const newQty =
        match.quantity != null && scaledQty != null
          ? match.quantity + scaledQty
          : scaledQty ?? match.quantity;

      const { error: updateErr } = await supabase
        .from('shopping_items')
        .update({
          quantity: newQty,
          ...(!match.source_recipe_id ? { source_recipe_id: recipeId } : {}),
        })
        .eq('id', match.id);

      if (updateErr) throw updateErr;
      merged++;
    } else {
      const { error: insertErr } = await supabase
        .from('shopping_items')
        .insert({
          shopping_list_id: shoppingListId,
          title: ingredient.title,
          quantity: scaledQty,
          unit: ingredient.unit ?? null,
          position: nextPosition++,
          source_recipe_id: recipeId,
          source_ingredient_id: ingredient.id,
          created_by: user.id,
        });

      if (insertErr) throw insertErr;
      added++;
    }
  }

  return { added, merged };
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

export interface RecipeRealtimeCallbacks {
  onInsert: (recipe: Recipe) => void;
  onUpdate: (recipe: Recipe) => void;
  onDelete: (oldRecipe: { id: string }) => void;
}

export function subscribeToRecipesRealtime(
  tripId: string,
  callbacks: RecipeRealtimeCallbacks,
): RealtimeChannel {
  const uid = Math.random().toString(36).slice(2, 8);
  const channel = supabase
    .channel(`recipes:${tripId}:${uid}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'recipes',
        filter: `trip_id=eq.${tripId}`,
      },
      (payload) => callbacks.onInsert(payload.new as unknown as Recipe),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'recipes',
        filter: `trip_id=eq.${tripId}`,
      },
      (payload) => callbacks.onUpdate(payload.new as unknown as Recipe),
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'recipes',
        filter: `trip_id=eq.${tripId}`,
      },
      (payload) => callbacks.onDelete(payload.old as { id: string }),
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromRecipes(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}

// ---------------------------------------------------------------------------
// Ingredient Realtime
// ---------------------------------------------------------------------------

export interface IngredientRealtimeCallbacks {
  onInsert: (ingredient: RecipeIngredient) => void;
  onUpdate: (ingredient: RecipeIngredient) => void;
  onDelete: (oldIngredient: { id: string; recipe_id: string }) => void;
}

export function subscribeToIngredientsRealtime(
  recipeId: string,
  callbacks: IngredientRealtimeCallbacks,
): RealtimeChannel {
  const uid = Math.random().toString(36).slice(2, 8);
  const channel = supabase
    .channel(`ingredients:${recipeId}:${uid}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'recipe_ingredients',
        filter: `recipe_id=eq.${recipeId}`,
      },
      (payload) => callbacks.onInsert(payload.new as unknown as RecipeIngredient),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'recipe_ingredients',
        filter: `recipe_id=eq.${recipeId}`,
      },
      (payload) => callbacks.onUpdate(payload.new as unknown as RecipeIngredient),
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'recipe_ingredients',
        filter: `recipe_id=eq.${recipeId}`,
      },
      (payload) => callbacks.onDelete(payload.old as { id: string; recipe_id: string }),
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromIngredients(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
