import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addIngredient, updateIngredient, deleteIngredient } from '@vacationist/api';
import type {
  RecipeIngredient,
  RecipeWithIngredients,
  CreateRecipeIngredientInput,
  UpdateRecipeIngredientInput,
} from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';

function useInvalidateShoppingQueries(tripId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
    queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
  };
}

export function useAddIngredient(recipeId: string, tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const invalidateShopping = useInvalidateShoppingQueries(tripId);

  return useMutation({
    mutationFn: (input: CreateRecipeIngredientInput) => addIngredient(recipeId, input),
    onSuccess: (newIngredient) => {
      queryClient.setQueryData<RecipeWithIngredients>(
        ['recipes', recipeId],
        (old) => {
          if (!old) return old;
          if (old.recipe_ingredients.some((i) => i.id === newIngredient.id)) return old;
          return {
            ...old,
            recipe_ingredients: [...old.recipe_ingredients, newIngredient],
            ingredient_count: old.ingredient_count + 1,
          };
        },
      );
      invalidateShopping();
    },
    onError: () => {
      addToast('error', 'Failed to add ingredient.');
    },
  });
}

export function useUpdateIngredient(recipeId: string, tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const invalidateShopping = useInvalidateShoppingQueries(tripId);

  return useMutation({
    mutationFn: ({
      ingredientId,
      input,
    }: {
      ingredientId: string;
      input: UpdateRecipeIngredientInput;
    }) => updateIngredient(ingredientId, input),
    onMutate: async ({ ingredientId, input }) => {
      await queryClient.cancelQueries({ queryKey: ['recipes', recipeId] });

      const previous = queryClient.getQueryData<RecipeWithIngredients>(['recipes', recipeId]);

      queryClient.setQueryData<RecipeWithIngredients>(
        ['recipes', recipeId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            recipe_ingredients: old.recipe_ingredients.map((ing) =>
              ing.id === ingredientId ? { ...ing, ...input } : ing,
            ),
          };
        },
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['recipes', recipeId], context.previous);
      }
      addToast('error', 'Failed to update ingredient.');
    },
    onSuccess: () => {
      invalidateShopping();
    },
  });
}

export function useDeleteIngredient(recipeId: string, tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const invalidateShopping = useInvalidateShoppingQueries(tripId);

  return useMutation({
    mutationFn: (ingredientId: string) => deleteIngredient(ingredientId),
    onMutate: async (ingredientId) => {
      await queryClient.cancelQueries({ queryKey: ['recipes', recipeId] });

      const previous = queryClient.getQueryData<RecipeWithIngredients>(['recipes', recipeId]);

      queryClient.setQueryData<RecipeWithIngredients>(
        ['recipes', recipeId],
        (old) => {
          if (!old) return old;
          const filtered = old.recipe_ingredients.filter((ing) => ing.id !== ingredientId);
          return {
            ...old,
            recipe_ingredients: filtered,
            ingredient_count: filtered.length,
          };
        },
      );

      return { previous };
    },
    onError: (_err, _ingredientId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['recipes', recipeId], context.previous);
      }
      addToast('error', 'Failed to delete ingredient.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', recipeId] });
      invalidateShopping();
      addToast('success', 'Ingredient removed');
    },
  });
}
