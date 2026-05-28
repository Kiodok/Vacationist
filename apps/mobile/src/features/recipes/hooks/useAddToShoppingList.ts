import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addRecipeToShoppingList } from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useAddRecipeToShoppingList(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({
      recipeId,
      shoppingListId,
      targetServings,
    }: {
      recipeId: string;
      shoppingListId: string;
      targetServings: number;
    }) => addRecipeToShoppingList(recipeId, shoppingListId, targetServings),
    onSuccess: ({ added, merged }, { shoppingListId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'shopping-lists'] });
      queryClient.invalidateQueries({ queryKey: ['shopping-lists', shoppingListId, 'items'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'all-shopping-items'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'recipe-shopping-status'] });

      addToast('success', i18n.t('recipes:toast.addedToList'));
    },
    onError: () => {
      addToast('error', i18n.t('recipes:toast.addToListFailed'));
    },
  });
}
