import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppForeground } from '../../../hooks/useAppForeground';
import { subscribeToRecipesRealtime, unsubscribeFromRecipes } from '@vacationist/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Recipe } from '@vacationist/types';

export function useRecipesRealtime(tripId: string) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const queryKey = ['trips', tripId, 'recipes'];

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      unsubscribeFromRecipes(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const subscribe = useCallback(() => {
    cleanup();

    const channel = subscribeToRecipesRealtime(tripId, {
      onInsert: (recipe) => {
        queryClient.setQueryData<(Recipe & { ingredient_count: number })[]>(queryKey, (old) => {
          if (!old) return [{ ...recipe, ingredient_count: 0 }];
          if (old.some((r) => r.id === recipe.id)) return old;
          return [...old, { ...recipe, ingredient_count: 0 }];
        });
      },
      onUpdate: (recipe) => {
        queryClient.setQueryData<(Recipe & { ingredient_count: number })[]>(queryKey, (old) =>
          old?.map((r) => (r.id === recipe.id ? { ...r, ...recipe } : r)),
        );
        queryClient.invalidateQueries({ queryKey: ['recipes', recipe.id] });
      },
      onDelete: (oldRecipe) => {
        queryClient.setQueryData<(Recipe & { ingredient_count: number })[]>(queryKey, (old) =>
          old?.filter((r) => r.id !== oldRecipe.id),
        );
        queryClient.removeQueries({ queryKey: ['recipes', oldRecipe.id] });
      },
    });

    channelRef.current = channel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, queryClient, cleanup]);

  useAppForeground(() => {
    subscribe();
    queryClient.invalidateQueries({ queryKey });
  }, !!tripId);

  useEffect(() => {
    if (!tripId) return;
    subscribe();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, subscribe, cleanup]);
}
