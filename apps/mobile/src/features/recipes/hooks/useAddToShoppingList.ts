import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addRecipeToShoppingList } from '@vacationist/api';
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

      const parts: string[] = [];
      if (added > 0) parts.push(`${added} item${added > 1 ? 's' : ''} added`);
      if (merged > 0) parts.push(`${merged} merged with existing`);

      addToast('success', parts.length > 0 ? parts.join(', ') : 'No items to add');
    },
    onError: () => {
      addToast('error', 'Failed to add ingredients to shopping list.');
    },
  });
}
