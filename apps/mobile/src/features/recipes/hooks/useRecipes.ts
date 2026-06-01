import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from '@vacationist/api';
import type { CreateRecipeInput, UpdateRecipeInput } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useRecipes(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ['trips', tripId, 'recipes'],
    queryFn: () => getRecipes(tripId),
    retry: 2,
    enabled: !!tripId && enabled,
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
      addToast('success', i18n.t('recipes:toast.created'));
    },
    onError: () => {
      addToast('error', i18n.t('recipes:toast.createFailed'));
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
      addToast('success', i18n.t('recipes:toast.updated'));
    },
    onError: () => {
      addToast('error', i18n.t('recipes:toast.updateFailed'));
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
      addToast('success', i18n.t('recipes:toast.deleted'));
    },
    onError: (error: Error) => {
      addToast('error', error.message || i18n.t('recipes:toast.deleteFailed'));
    },
  });
}
