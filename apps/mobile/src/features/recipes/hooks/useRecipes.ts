import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from '@vacationist/api';
import type { CreateRecipeInput, UpdateRecipeInput } from '@vacationist/types';
import { useToastStore } from '../../../stores/toastStore';

export function useRecipes(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'recipes'],
    queryFn: () => getRecipes(tripId),
    retry: 2,
    enabled: !!tripId,
  });
}

export function useRecipe(recipeId: string) {
  return useQuery({
    queryKey: ['recipes', recipeId],
    queryFn: () => getRecipe(recipeId),
    retry: 2,
    enabled: !!recipeId,
  });
}

export function useCreateRecipe(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: CreateRecipeInput) => createRecipe(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'recipes'] });
      addToast('success', 'Recipe created');
    },
    onError: () => {
      addToast('error', 'Failed to create recipe.');
    },
  });
}

export function useUpdateRecipe(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ recipeId, input }: { recipeId: string; input: UpdateRecipeInput }) =>
      updateRecipe(recipeId, input),
    onSuccess: (_data, { recipeId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipes', recipeId] });
      addToast('success', 'Recipe updated');
    },
    onError: () => {
      addToast('error', 'Failed to update recipe.');
    },
  });
}

export function useDeleteRecipe(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (recipeId: string) => deleteRecipe(recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'recipes'] });
      addToast('success', 'Recipe deleted');
    },
    onError: (error: Error) => {
      addToast('error', error.message || 'Failed to delete recipe.');
    },
  });
}
