import { useQuery } from '@tanstack/react-query';
import { getRecipeShoppingStatus } from '@vacationist/api';

export function useRecipeShoppingStatus(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ['trips', tripId, 'recipe-shopping-status'],
    queryFn: () => getRecipeShoppingStatus(tripId),
    retry: 2,
    enabled: !!tripId && enabled,
  });
}
